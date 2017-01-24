'use strict'

$(function() {

	window.Renderer = {
		

		init: function() {
			Renderer.render();
		},

		render: function() {
			var draw = SVG('svg').size(300,300);
			var rect = draw.rect(100,100).attr({fill: 'yellow'});
			var text = draw.text("lorem ipsum");
			text.transform({scaleX: 0.5, scaleY: 0.5});
		}

	};
});

