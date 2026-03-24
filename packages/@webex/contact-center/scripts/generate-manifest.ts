/**
 * SDK Manifest Generator
 *
 * Uses ts-morph to statically analyze the @webex/contact-center package
 * and produce a machine-readable sdk-manifest.yaml describing the public API surface.
 *
 * What it captures:
 * - Exported classes and their public methods (params, return types)
 * - Event emissions per method (trigger/emit calls resolved to string values)
 * - Exported enums and their values
 * - Exported types/interfaces and their fields
 * - Exported constants
 *
 * Usage: npx ts-node scripts/generate-manifest.ts
 */

/* eslint-disable no-console, no-continue, import/no-extraneous-dependencies */
import {
  Project,
  Node,
  SyntaxKind,
  ClassDeclaration,
  TypeAliasDeclaration,
  InterfaceDeclaration,
  MethodDeclaration,
} from 'ts-morph';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

const PKG_ROOT = path.resolve(__dirname, '..');
const ENTRY_FILE = path.join(PKG_ROOT, 'src/index.ts');
const OUTPUT_FILE = path.join(PKG_ROOT, 'sdk-manifest.yaml');

interface ParamInfo {
  name: string;
  type: string;
  required: boolean;
}

interface MethodInfo {
  params: ParamInfo[];
  returns: string;
  events_on_success: string[];
  events_on_failure: string[];
}

interface ClassInfo {
  source: string;
  extends: string | null;
  methods: Record<string, MethodInfo>;
}

interface FieldInfo {
  name: string;
  type: string;
  required: boolean;
}

interface TypeInfo {
  kind?: string;
  fields?: FieldInfo[];
  values?: string[];
}

interface Manifest {
  name: string;
  version: string;
  generated_at: string;
  generator: string;
  classes: Record<string, ClassInfo>;
  events: Record<string, Record<string, string>>;
  types: Record<string, TypeInfo>;
  constants: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize type text by replacing absolute paths with relative ones.
 */
function sanitizeType(typeText: string): string {
  // Replace absolute import paths with relative package paths
  return typeText.replace(/import\("[^"]*\/packages\/@webex\/contact-center\/([^"]+)"\)\./g, '$1:');
}

/**
 * Resolve an enum member access (e.g., AGENT_EVENTS.STATE_CHANGE) to its string value.
 */
function resolveEnumValue(project: Project, expression: string): string | null {
  // expression might be like "TASK_EVENTS.TASK_INCOMING"
  const parts = expression.split('.');
  if (parts.length !== 2) return null;

  const [enumName, memberName] = parts;

  for (const sf of project.getSourceFiles()) {
    const enumDec = sf.getEnum(enumName);
    if (enumDec) {
      const member = enumDec.getMember(memberName);
      if (member) {
        const val = member.getValue();

        return typeof val === 'string' ? val : null;
      }
    }
  }

  return null;
}

/**
 * Extract event emissions from a method body.
 * Looks for patterns like:
 *   this.trigger(SOME_ENUM.MEMBER, ...)
 *   this.emit(SOME_ENUM.MEMBER, ...)
 *
 * Returns separate success/failure arrays based on try/catch context.
 */
function extractEvents(
  project: Project,
  method: MethodDeclaration
): {success: string[]; failure: string[]} {
  const success: string[] = [];
  const failure: string[] = [];

  const body = method.getBody();
  if (!body) return {success, failure};

  const callExpressions = body.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    const expr = call.getExpression();

    // Match this.trigger(...) or this.emit(...)
    if (!Node.isPropertyAccessExpression(expr)) continue;
    const methodName = expr.getName();
    if (methodName !== 'trigger' && methodName !== 'emit') continue;

    const objExpr = expr.getExpression();
    if (!Node.isThisExpression(objExpr)) continue;

    // Get the first argument (the event name)
    const args = call.getArguments();
    if (args.length === 0) continue;

    const firstArg = args[0];
    let eventValue: string | null = null;

    if (Node.isStringLiteral(firstArg)) {
      eventValue = firstArg.getLiteralValue();
    } else if (Node.isPropertyAccessExpression(firstArg)) {
      const enumExpr = firstArg.getText();
      eventValue = resolveEnumValue(project, enumExpr);
    }

    if (!eventValue) continue;

    // Determine if inside catch block
    let parent = call.getParent();
    let inCatch = false;
    while (parent) {
      if (Node.isCatchClause(parent)) {
        inCatch = true;
        break;
      }
      parent = parent.getParent();
    }

    if (inCatch) {
      if (!failure.includes(eventValue)) failure.push(eventValue);
    } else if (!success.includes(eventValue)) success.push(eventValue);
  }

  return {success, failure};
}

/**
 * Extract public methods from a class declaration.
 */
function extractMethods(project: Project, cls: ClassDeclaration): Record<string, MethodInfo> {
  const methods: Record<string, MethodInfo> = {};

  for (const method of cls.getMethods()) {
    // Skip private/protected
    if (method.hasModifier(SyntaxKind.PrivateKeyword)) continue;
    if (method.hasModifier(SyntaxKind.ProtectedKeyword)) continue;

    // Skip methods starting with underscore (convention for internal)
    const name = method.getName();
    if (name.startsWith('_')) continue;

    const params: ParamInfo[] = method.getParameters().map((p) => ({
      name: p.getName(),
      type: sanitizeType(p.getType().getText(p)),
      required: !p.isOptional() && !p.hasInitializer(),
    }));

    const returnType = sanitizeType(method.getReturnType().getText(method));

    const events = extractEvents(project, method);

    methods[name] = {
      params,
      returns: returnType,
      events_on_success: events.success,
      events_on_failure: events.failure,
    };
  }

  return methods;
}

/**
 * Extract fields from an interface or type alias.
 */
function extractTypeFields(decl: InterfaceDeclaration | TypeAliasDeclaration): TypeInfo {
  if (Node.isInterfaceDeclaration(decl)) {
    const fields: FieldInfo[] = decl.getProperties().map((prop) => ({
      name: prop.getName(),
      type: sanitizeType(prop.getType().getText(prop)),
      required: !prop.hasQuestionToken(),
    }));

    return {fields};
  }

  if (Node.isTypeAliasDeclaration(decl)) {
    const typeNode = decl.getTypeNode();

    // Union type like 'BROWSER' | 'EXTENSION' | 'AGENT_DN'
    if (typeNode && Node.isUnionTypeNode(typeNode)) {
      const values = typeNode.getTypeNodes().map((t) => t.getText());

      return {kind: 'union', values};
    }

    // Object type literal
    if (typeNode && Node.isTypeLiteral(typeNode)) {
      const fields: FieldInfo[] = typeNode.getProperties().map((prop) => ({
        name: prop.getName(),
        type: sanitizeType(prop.getType().getText(prop)),
        required: !prop.hasQuestionToken(),
      }));

      return {fields};
    }

    // Fallback: just record the type text
    return {kind: 'alias', values: [sanitizeType(decl.getType().getText(decl))]};
  }

  return {};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function generate(): void {
  console.log('Loading TypeScript project...');
  const project = new Project({
    tsConfigFilePath: path.join(PKG_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  const entryFile = project.getSourceFileOrThrow(ENTRY_FILE);

  console.log('Analyzing exports...');
  const exportedDeclarations = entryFile.getExportedDeclarations();

  const manifest: Manifest = {
    name: '@webex/contact-center',
    version: '',
    generated_at: new Date().toISOString(),
    generator: 'generate-manifest.ts v1.0',
    classes: {},
    events: {},
    types: {},
    constants: {},
  };

  // Read version from package.json
  const pkgJson = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  manifest.version = pkgJson.version || 'workspace';

  // Track seen classes to skip 'default' re-export duplicates
  const seenClassFiles = new Set<string>();
  // Track seen enums to skip type re-exports (e.g., TaskEvents = TASK_EVENTS)
  const seenEnumFiles = new Set<string>();

  for (const [exportName, declarations] of exportedDeclarations) {
    for (const decl of declarations) {
      // --- Classes ---
      if (Node.isClassDeclaration(decl)) {
        const sourceFile = decl.getSourceFile();
        const relativePath = path.relative(PKG_ROOT, sourceFile.getFilePath());

        // Skip duplicate class exports (e.g., 'default' re-exporting ContactCenter)
        if (seenClassFiles.has(relativePath)) continue;
        seenClassFiles.add(relativePath);

        console.log(`  Class: ${exportName}`);

        const extendsClause = decl.getExtends();
        const extendsText = extendsClause ? extendsClause.getText() : null;

        manifest.classes[exportName] = {
          source: relativePath,
          extends: extendsText,
          methods: extractMethods(project, decl),
        };
      }

      // --- Enums ---
      else if (Node.isEnumDeclaration(decl)) {
        const sourceFile = decl.getSourceFile();
        const enumKey = `${sourceFile.getFilePath()}:${decl.getName()}`;

        // Skip duplicate enum exports (e.g., TaskEvents type re-export of TASK_EVENTS)
        if (seenEnumFiles.has(enumKey)) continue;
        seenEnumFiles.add(enumKey);

        console.log(`  Enum: ${exportName}`);
        const members: Record<string, string> = {};
        for (const member of decl.getMembers()) {
          const val = member.getValue();
          if (typeof val === 'string') {
            members[member.getName()] = val;
          }
        }
        manifest.events[exportName] = members;
      }

      // --- Interfaces ---
      else if (Node.isInterfaceDeclaration(decl)) {
        manifest.types[exportName] = extractTypeFields(decl);
      }

      // --- Type Aliases ---
      else if (Node.isTypeAliasDeclaration(decl)) {
        manifest.types[exportName] = extractTypeFields(decl);
      }

      // --- Variable declarations (constants) ---
      else if (Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && Node.isStringLiteral(init)) {
          manifest.constants[exportName] = init.getLiteralValue();
        } else if (init && Node.isNumericLiteral(init)) {
          manifest.constants[exportName] = init.getLiteralValue();
        }
      }
    }
  }

  // Write YAML
  const yamlContent = yaml.dump(manifest, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });

  fs.writeFileSync(OUTPUT_FILE, yamlContent, 'utf8');

  // Summary
  const classCount = Object.keys(manifest.classes).length;
  const methodCount = Object.values(manifest.classes).reduce(
    (sum, cls) => sum + Object.keys(cls.methods).length,
    0
  );
  const enumCount = Object.keys(manifest.events).length;
  const typeCount = Object.keys(manifest.types).length;
  const constCount = Object.keys(manifest.constants).length;

  console.log(`\nManifest generated: ${OUTPUT_FILE}`);
  console.log(`  Classes: ${classCount} (${methodCount} methods)`);
  console.log(`  Enums: ${enumCount}`);
  console.log(`  Types: ${typeCount}`);
  console.log(`  Constants: ${constCount}`);
}

generate();
