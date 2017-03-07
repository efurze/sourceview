'use strict'


var COLORS = {
 FILES_BACKGROUND: 	'#F0DAA4', 	// goldenrod
 REPO_BACKGROUND: 	'#A2BCCD', 	// light blue
 REPO: 				'rgb(130,150,164)', // medium blue
 REPO_HIGHLIGHT:	'#808080',
 REPO_SELECT:		'#f0dba5',
 DIFF: 				'rgb(66, 77, 84)',	// blue-black
 DIFF_HIGHLIGHT: 	'#FFFFD5',	// light yellow 

 REPO_DIR: 			'#686a83', 	// 
 DIFF_DIR: 			'#414252',	// 
};

var REPO_RGB = {
	r: 130,
	g: 150,
	b: 164
};

var FONT_NORMAL = {
	'name': '8px Helvetica',
	'height': 8,
	'color': 'black'
};

var FONT_LARGE = {
	'name': '12px Helvetica',
	'height': 12,
	'color': 'black'
};

var FONT_DIR = {
	'name': '12px Helvetica',
	'height': 12,
	'color': 'BLUE'
};

var AUTHOR_COLORS = [
	'rgb(200,0,0)',
	'rgb(0,0,200)',
	'rgb(0,200,0)',
	'rgb(200,200,0)',
	'rgb(255,165,0)'
];

function ASSERT(cond) {
	if (!cond) {
		debugger
	}
}
