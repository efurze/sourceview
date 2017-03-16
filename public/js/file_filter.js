var FileFilter = function() {
  var self = this;
  self._filters = [];
}

FileFilter.prototype.addFilter = function(glob) {
  var self = this;
  self._filters.push(glob);
}

FileFilter.prototype.matches = function(path) {
  var self = this;
  if (!self._filters.length)
    return true;
  
  for (var i=0; i < self._filters.length; i++) {
    if (minimatch(path, self._filters[i])) {
      return true;
    }
  }
  return false;
}

FileFilter.prototype.filterTree = function(tree, path) {
  var self = this;
  path = path || '/';

  var ret = {
    size: tree.size,
    subdir_count: tree.subdir_count,
    children: {}
  };
  
  Object.keys(tree.children).forEach(function(child) {
    if (self.matches(path + child)) {
      if (typeof(tree.children[child]) == 'object') {
        ret.children[child] = self.filterTree(tree.children[child], path+child+'/');
      } else {
        ret.children[child] = tree.children[child];
      }
    }
  });
  return ret;
}
