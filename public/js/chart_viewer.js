'use strict'

var ChartViewer = function(data) {
	var self = this;
	this._commitList = data.revList;
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
   	self._commitList.forEach(function(commit, index) {
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
   	self.drawAuthors(0);
}

ChartViewer.prototype.drawDiffs = function(smoothing_window) {
	var self = this;
	if (self._linesChanged) {
	   	var linesChangedTable = new google.visualization.DataTable();

	   	linesChangedTable.addColumn('date', 'date');
	   	linesChangedTable.addColumn('number', 'lineCount');

	   	var deltaData = [];
	   	self._commitList.forEach(function(commit, index) {
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


ChartViewer.prototype.drawAuthors = function(smoothing_window) {
	var self = this;
	if (self._linesChanged) {
	   	var authorsTable = new google.visualization.DataTable();

	   	var data = [];
	   	var author_list = {};
	   	self._commitList.forEach(function(commit, index) {
	   		var running_total = index > 0 
	   			? JSON.parse(JSON.stringify(data[index-1])) 
	   			: {}; // author: count

	   		if (!running_total.hasOwnProperty(commit.author_name)) {
	   			running_total[commit.author_name] = 0;
	   			author_list[commit.author_name] = true;
	   		}

	   		running_total[commit.author_name] += self._linesChanged[index];
	   		if (running_total[commit.author_name] < 0)
	   			running_total[commit.author_name] = 0;
	   		data.push(running_total);
	   	});

	   	var author_names = Object.keys(author_list);
	   	author_names.sort(function(a,b) {
	   		return data[data.length-1][a] - data[data.length-1][b];
	   	});

	   	var author_data = [];
	   	author_names = author_names.slice(0, 10);
	   	data.forEach(function(total, index) {
	   		var row_data = [index];
	   		author_names.forEach(function(name) {
	   			row_data.push(total[name] || 0);
	   		});
	   		author_data.push(row_data);
	   	});



	   	authorsTable.addColumn('number', 'commit');
	   	author_names.forEach(function(name) {
	   		authorsTable.addColumn('number', name);
	   	});

	   

	   	authorsTable.addRows(author_data);

	   	var options = {
		   	hAxis: {
		   		title: 'Commits'
		   	},
		   	vAxis: {
		    	title: 'Lines Owned'
		   	},
		   	colors: ['#a52714', '#097138']
	   	};

	   	var chart = new google.visualization.LineChart(document.getElementById('chart_div2'));
	   	chart.draw(authorsTable, options);
	}
}

ChartViewer.prototype.onSmoothClick = function(event) {
	var smoothing_window = $("#smooth_input").val();
	if (!smoothing_window || smoothing_window <= 0) {
		smoothing_window = 1;
	}

	this.drawDiffs(smoothing_window);
	this.drawAuthors(smoothing_window);
}