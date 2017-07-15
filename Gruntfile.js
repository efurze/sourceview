// Here's a decent resource on Gruntfile.js:
// http://techblog.troyweb.com/index.php/2014/05/using-grunt-to-auto-restart-node-js-with-file-watchers/

module.exports = function(grunt) {

  grunt.initConfig({
    
    
    concurrent: {
      dev: [
        'watch',
        'nodemon'
      ],
      options: {
      logConcurrentOutput: true
      }
    },
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: ['lib/logger.js', 'public/**/*.js'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    babel: {
      "options": {
        "sourceMap": true,
        "minified": true
      },
      dist: {
          files: [{
              "src": ["dist/<%= pkg.name %>.js"],
              "dest": "dist/<%= pkg.name %>.min.js",
              "ext": ".js"
          }]
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    },
    qunit: {
      files: ['test/**/*.html']
    },
    jshint: {
      files: ['Gruntfile.js', 'lib/logger.js', 'public/js/*.js', 'index.js', 'controllers/*.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>', 'views/**/*.hbs'],
      tasks: ['concat', 'babel']//['jshint', 'qunit']
    },
    nodemon: {
        dev: {
            script: 'index.js'
        }
    },
  });

  grunt.loadNpmTasks('grunt-concurrent');
  grunt.loadNpmTasks('grunt-nodemon');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  //grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  //grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('test', ['qunit']);
  grunt.registerTask('default', ['concat', 'babel']);
  grunt.registerTask('small', ['concat', 'uglify']);
  grunt.registerTask('server', ['concurrent']);

};
