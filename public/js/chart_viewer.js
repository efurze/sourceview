'use strict'

var ChartViewer = function(data) {
	this._revList = data.revList;
	this._lineCount = data.lineCount;
	this._linesChanged = data.linesChanged;
}

ChartViewer.prototype.drawChart = function() {
	var self = this;

	var lineCountTable = new google.visualization.DataTable();

   	lineCountTable.addColumn('number', 'commit');
   	lineCountTable.addColumn('number', 'lineCount');

   	var rowData = [];
   	self._revList.forEach(function(sha, index) {
   		rowData.push([index, self._lineCount[index]]);
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

   	if (self._linesChanged) {
	   	var linesChangedTable = new google.visualization.DataTable();

	   	linesChangedTable.addColumn('number', 'commit');
	   	linesChangedTable.addColumn('number', 'lineCount');

	   	var deltaData = [];
	   	self._revList.forEach(function(sha, index) {
	   		deltaData.push([index, self._linesChanged[index]]);
	   	});
	   	linesChangedTable.addRows(deltaData);

	   	options = {
		   	hAxis: {
		   		title: 'Commit Number'
		   	},
		   	vAxis: {
		    	title: 'Lines Changed Per Commit'
		   	},
		   	colors: ['#a52714', '#097138']
	   	};

	   	chart = new google.visualization.LineChart(document.getElementById('chart_div1'));
	   	chart.draw(linesChangedTable, options);
	   }
}