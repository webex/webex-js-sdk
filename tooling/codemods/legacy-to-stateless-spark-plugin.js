/* eslint-disable no-console */
/* eslint-disable no-param-reassign */


module.exports = function transform({source}, {jscodeshift: j}) {
  const root = j(source);

  const propNames = [
    'children',
    'derived',
    'props',
    'session'
  ];

  let className;
  const stateless = root
    .find(j.CallExpression, {
      callee: {
        object: {name: 'SparkPlugin'},
        property: {name: 'extend'}
      }
    })
    .filter((p) => {
      className = p.parentPath.value.id.name;
      const {properties} = p.node.arguments[0];
      for (const property of properties) {
        if (propNames.includes(property.key.name)) {
          return false;
        }
      }
      return true;
    }).length === 1;

  if (!className) {
    return root.toSource();
  }

  if (!stateless) {
    console.log(`${className} is not stateless. Cannot transform.`);
    return root.toSource();
  }
  console.log(`${className} is stateless. transforming.`);

  // import StatelessSparkPlugin
  root
    .find(j.ImportSpecifier, {
      imported: {
        name: 'SparkPlugin'
      }
    })
    .replaceWith(() => j.importSpecifier(
      j.identifier('StatelessSparkPlugin'),
      j.identifier('StatelessSparkPlugin')
    ));

  // remove default export
  root
    .find(j.ExportDefaultDeclaration)
    .replaceWith(() => null);


  let classBody = [];
  // create class
  root
    .find(j.CallExpression, {
      callee: {
        object: {name: 'SparkPlugin'},
        property: {name: 'extend'}
      }
    })
    .map((p) => {
      classBody = p.node.arguments[0].properties
        .map(({
          key, params, body,
          value,
          comments,
          decorators
        }, index, arr) => {
          const node = arr[index];
          let m;
          if (node.type === 'ObjectProperty') {
          // change non-function properties to properties
            m = j.classProperty(key, value, null);
          }
          else if (node.type === 'ObjectMethod') {
            // convert initialize to constructor (feature.js)
            if (key.name === 'initialize') {
              key.name = 'constructor';
            }
            // change function properties to methods
            m = j.classMethod('method', key, params, body);
          }
          else {
            throw new Error('discovered an class member that is neither a property or a method');
          }

          if (comments) {
          // remove memberof, instance from docs
            comments.forEach((comment) => {
              comment.value = comment.value
                .replace(/\n\s+\*\s+@instance.*?\n/, '\n')
                .replace(/\n\s+\*\s+@memberof.*?\n/, '\n');
            });
          }

          m.comments = comments;
          m.leadingComments = comments;

          // retain decorators
          m.decorators = decorators;

          return m;
        });
      return p.parentPath;
    })
    // export class as default
    .replaceWith(() => j.exportDefaultDeclaration(
      j.classDeclaration(
        j.identifier(className),
        j.classBody(classBody),
        j.identifier('StatelessSparkPlugin')
      )
    ))
    .forEach((p) => {
      p.parentPath.node.kind = '';
    });

  // rewrite super call
  root
    .find(j.CallExpression, {
      callee: {
        object: {name: 'Reflect'},
        property: {name: 'apply'}
      },
      arguments: [
        {
          object: {
            object: {name: 'SparkPlugin'},
            property: {name: 'prototype'}
          },
          property: {name: 'initialize'}
        }
      ]
    })
    .replaceWith(() => j.callExpression(
      j.identifier('super'),
      [
        j.spreadElement(j.identifier('args'))
      ]
    ));

  return `${root
    .toSource()
    // fix docblock indentation.
    // .replace(/ {2}\*/g, '*')
    .replace(/ export/g, 'export')}\n`;
};
