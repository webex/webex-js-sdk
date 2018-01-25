/* eslint-disable no-console */
/* eslint-disable no-param-reassign */


module.exports = function transform({source}, {jscodeshift: j}) {
  const root = j(source);

  root
    .find(j.ClassDeclaration, {
      superClass: {name: 'StatelessSparkPlugin'}
    })
    .forEach((p) => {
      p.node.body.body.sort((left, right) => {
        if (left.type === 'ClassProperty' && right.type === 'ClassMethod') {
          return -1;
        }
        if (left.type === 'ClassMethod' && right.type === 'ClassProperty') {
          return 1;
        }

        if (left.key.name < right.key.name) {
          return -1;
        }

        if (left.key.name > right.key.name) {
          return 1;
        }
        return 0;
      });
    });

  return `${root.toSource()}`;
};
