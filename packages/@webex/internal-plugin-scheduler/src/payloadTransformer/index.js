import predicates from './predicates';
import transformers from './transformers';

const payloadTransformer = {
  predicates: Object.values(predicates),
  transforms: Object.values(transformers),
};

export default payloadTransformer;
