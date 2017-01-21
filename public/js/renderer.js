'use strict'

$(function() {

	window.Renderer = {

		init: function(element_id) {
			bonsai.run(document.getElementById(element_id), {
		    code: Renderer.render,
		    width: 500,
		    height: 400
		  });
		},

		render: function() {
			new Rect(10, 10, 100, 100)
			        .addTo(stage)
			        .attr('fillColor', 'green');
		}

	};
});

