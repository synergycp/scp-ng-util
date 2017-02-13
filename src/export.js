var _ = require('lodash');
var Q = require('q');
var glob = require('glob/glob');
var resolve = require('resolve');

module.exports = makeExport;

function makeExport(name, dirname) {
  return new Exporter(name, dirname);
}

function Exporter(name, dirname) {
  var Export = this;
  var promises = [];

  Export.isScpExporter = true;
  Export.node = node;
  Export.static = doStatic;
  Export.include = include;
  Export.add = add;
  Export.all = all;

  function all() {
    var flattened = [];

    return Q
      .all(promises)
      .then(flatten)
      .then(function() {
        return flattened;
      })
      ;

    function flatten(promiseResults) {
      return Q.all(
        _.map(promiseResults, promiseToAddFlattened)
      );
    }

    function promiseToAddFlattened(result) {
      if (result instanceof Array) {
        return Q.all(
          _.map(result, promiseToAddFlattened)
        );
      }

      if (result.isScpExporter) {
        return result
          .all()
          .then(promiseToAddFlattened)
          ;
      }

      flattened.push(result);
    }
  }

  function add(promise) {
    promises.push(promise);

    return Export;
  }

  function include(mods) {
    _(mods)
      .map(promiseToResolveModExports)
      .map(Export.add)
      .value()
      ;

    return Export;
  }

  function doStatic(files) {
    return Export.add(
      Q.when({
        name: name,
        dirname: dirname,
        files: files,
      })
    );
  }

  function node(relFiles) {
    return Export.add(
      getFiles()
        .then(function (files) {
          if (!files || !files.length) {
            console.error('No files resolved for ' + relFiles);
          }

          return {
            name: name,
            dirname: getNodeDir(files),
            files: files,
          };
        })
    );

    function getFiles() {
      return Q.all(
        _.map(relFiles, promiseToResolveGlob)
      );
    }

    function getNodeDir(files) {
      var nodeDir = '/node_modules/';
      var sp = files[0].split(nodeDir);

      return sp.pop() && sp.join(nodeDir);
    }
  }

  function promiseToResolveModExports(mod) {
    return promiseResolve(mod + '/exports.js', { basedir: dirname, })
      .then(require.bind(require))
      .then(function (exported) {
        return exported;
      })
      .catch(function (err) {
        throw new Error('Failed to load '+ mod + ': ' + err);
        console.error(err);
      });
  }

  function promiseToResolveGlob(file) {
    return promiseResolve(file, {
      basedir: dirname,
      isFile: isGlobFile,
    });
  }

  function promiseResolve(file, options) {
    var defer = Q.defer();

    resolve(file, options, function (err, res) {
      if (err) {
        return defer.reject(err);
      }

      defer.resolve(res);
    });

    return defer.promise;
  }

  function isGlobFile(pattern, cb) {
    promiseGlob(pattern).then(function (files) {
      cb(null, files && files.length);
    }).catch(function () {
      cb(null, false);
    });
  }

  function promiseGlob(pattern) {
    var defer = Q.defer();

    glob(pattern, function (err, files) {
      if (err) {
        return defer.reject(err);
      }

      defer.resolve(files);
    });

    return defer.promise;
  }
}
