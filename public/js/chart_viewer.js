'use strict'

var ChartViewer = function(data) {
	var self = this;
	this._revList = data.revList;
	this._lineCount = data.lineCount;
	this._linesChanged = data.linesChanged;

	$("#smooth_button").on('click', self.onSmoothClick.bind(self));
}

ChartViewer.prototype.drawChart = function() {
	var self = this;

	var lineCountTable = new google.visualization.DataTable();

   	lineCountTable.addColumn('date', 'date');
   	lineCountTable.addColumn('number', 'lineCount');

   	var rowData = [];
   	self._revList.forEach(function(commit, index) {
   		var d;
   		if (commit.date.match(/[a-zA-Z]/)) {
   			d = new Date(commit.date);
   		} else {
   			var parts = commit.date.split('-');
   			d = new Date(parseInt(parts[0].trim() * 1000));
   		}
   		rowData.push([d, self._lineCount[index]]);
   	});

   	lineCountTable.addRows(rowData);

   	var options = {
	   	hAxis: {
	   		title: 'Commit Number'
	   	},
	   	vAxis: {
	    	title: 'Line Count'
	   	},
	   	colors: ['#a52714', '#097138']
   	};

   	var chart = new google.visualization.LineChart(document.getElementById('chart_div'));
   	chart.draw(lineCountTable, options);

   	//=======

   	self.drawDiffs(0);
}

ChartViewer.prototype.drawDiffs = function(smoothing_window) {
	var self = this;
	if (self._linesChanged) {
	   	var linesChangedTable = new google.visualization.DataTable();

	   	linesChangedTable.addColumn('date', 'date');
	   	linesChangedTable.addColumn('number', 'lineCount');

	   	var deltaData = [];
	   	self._revList.forEach(function(commit, index) {
	   		var d;
	   		if (commit.date.match(/[a-zA-Z]/)) {
	   			d = new Date(commit.date);
	   		} else {
	   			var parts = commit.date.split('-');
	   			d = new Date(parseInt(parts[0].trim() * 1000));
	   		}
	   		deltaData.push([d, self._linesChanged[index]]);
	   	});

	   	if (smoothing_window > 0) {
	   		var running_total = 0;
	   		for (var i=0; i < deltaData.length; i++) {
	   			running_total += deltaData[i][1];
	   			if (i >= smoothing_window) {
	   				running_total -= deltaData[i-smoothing_window][1];
	   			}
	   			deltaData[i][1] = running_total / Math.min(smoothing_window, i+1);
	   		}
	   	}

	   	linesChangedTable.addRows(deltaData);

	   	var options = {
		   	hAxis: {
		   		title: 'Commit Number'
		   	},
		   	vAxis: {
		    	title: 'Lines Changed Per Commit'
		   	},
		   	colors: ['#a52714', '#097138']
	   	};

	   	var chart = new google.visualization.LineChart(document.getElementById('chart_div1'));
	   	chart.draw(linesChangedTable, options);
	}
}

ChartViewer.prototype.onSmoothClick = function(event) {
	var smoothing_window = $("#smooth_input").val();
	if (!smoothing_window || smoothing_window <= 0) {
		smoothing_window = 1;
	}

	this.drawDiffs(smoothing_window);
}