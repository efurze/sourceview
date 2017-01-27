var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var Diff = require('../controllers/types/diff.js');

var diffstr = "diff --git a/controllers/repo.js b/controllers/repo.js\n\
index 9761de2..0d1b027 100644\n\
--- a/controllers/repo.js\n\
+++ b/controllers/repo.js\n\
@@ -169,7 +169,7 @@ Repo.prototype.diffHistory = function(branch_name) { // eg 'master'\n\
                                        return self._git.diff(history[index+1].id, commit.id)\n\
                                                .then(function(diff) {\n\
                                                        delete commit.parents;\n\
-                                                       console.log(JSON.stringify(diff));\n\
+                                                       //console.log(JSON.stringify(diff));\n\
                                                        return {\n\
                                                                \n\"commit\n\": commit,\n\
                                                                \n\"diffs\n\": diff._summary\n\
diff --git a/public/js/canvas_renderer.js b/public/js/canvas_renderer.js\n\
index 0d0fc7c..0689ffb 100644\n\
--- a/public/js/canvas_renderer.js\n\
+++ b/public/js/canvas_renderer.js\n\
@@ -363,16 +363,34 @@ CanvasRenderer.prototype.handleMouseYChange = function(event) {\n\
        }\n\
 };\n\
 \n\
-// TODO: make this a binary search\n\
+CanvasRenderer.prototype.filePixelOffset = function(filename) {\n\
+       var self = this;\n\
+       return (self._yAxis[filename] * self._height) / self._maxLineCount;\n\
+};\n\
+\n\
+\n\
 CanvasRenderer.prototype.fileFromYCoord = function(y) {\n\
        var self = this;\n\
-       for (var i=0; i < self._files.length; i++) {\n\
-               var pixelOffset = (self._yAxis[self._files[i]] * self._height) / self._maxLineCount;\n\
-               if (y <= pixelOffset) {\n\
-                       return i > 0 ? self._files[i-1] : self._files[0];\n\
+       var index = 0;\n\
+       var offset = 0;\n\
+       var next_index = self._files.length - 1;\n\
+       var next_offset = self._height;\n\
+\n\
+       while (next_index - index > 1) {\n\
+               var bisect_index = Math.round((next_index+index)/2);\n\
+               var bisect_offset = self.filePixelOffset(self._files[bisect_index]);\n\
+\n\
+               if (y <= bisect_offset) {\n\
+                       next_index = bisect_index;\n\
+                       next_offset = bisect_offset;\n\
+               } else {\n\
+                       index = bisect_index;\n\
+                       offset = bisect_offset;\n\
                }\n\
+\n\
+               console.log(index, next_index);\n\
        }\n\
-       return \n\"\n\";\n\
+       return self._files[index];\n\
 }\n\
 \n\
 CanvasRenderer.prototype.commitIndexFromXCoord = function(x) {";

describe('diff parse test', function() {
  it('should parse a unified diff', function(done) {
    var diff = new Diff();
    diff.parse(diffstr);
        done();
    });
  });

