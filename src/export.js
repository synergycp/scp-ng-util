var _ = require('lodash');

module.exports = makeExport;

function makeExport(name) {
  return new Exporter(name);
}

function Exporter(name) {
  var Export = this;

  Export.node = node;

  function node(relFiles) {
    var files = _.map(relFiles, require.resolve);
    var nodeDir = '/node_modules/';
    var sp = files[0].split(nodeDir);

    return {
      name: name,
      dirname: sp.pop() && sp.join(nodeDir),
      files: files,
    };
  }
}
