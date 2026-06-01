export type InterpreterUsingResource = {
  id: string;
  email?: string;
};

export type Interpreter = {
  order: number;
  sourceLanguage: string;
  targetLanguage: string;
  usingResource: InterpreterUsingResource;
};
