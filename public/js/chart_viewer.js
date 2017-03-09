'use strict'

var ChartViewer = function(data) {
	this._revList = data.revList;
	this._lineCount = data.lineCount;
}

ChartViewer.prototype.drawChart = function() {
	var self = this;

	var data = new google.visualization.DataTable();

   	data.addColumn('number', 'commit');
   	data.addColumn('number', 'lineCount');

   	var rowData = [];
   	self._revList.forEach(function(sha, index) {
   		rowData.push([index, self._lineCount[index]]);
   	});

   data.addRows(rowData);

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
   chart.draw(data, options);
}