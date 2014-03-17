App.prototype._pieChart = function( votes ) {
  
  var width = 150,
      height = 150,
      radius = Math.min(width, height) / 2;

  var color = d3.scale.ordinal()
      .range(["#4DB8F6", "#2479A9", "#98D4F7", "#666556", "#FFB90A", "#d0743c", "#ff8c00"]);

  var arc = d3.svg.arc()
      .outerRadius(radius - 10)
      .innerRadius(0);

  var pie = d3.layout.pie()
      .sort(null)
      .value(function(d) { return d.count; });

  var svg = d3.select("#pie-chart-votes").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  var data = [];
  for ( var d in votes ) {
    if (votes[d] > 0) {
      var obj = {"type": d, "count": votes[d]};
      data.push(obj);
    }
  }
  
  data.forEach(function(d) {
    d.count = +d.count;
  });

  var g = svg.selectAll(".arc")
      .data(pie(data))
    .enter().append("g")
      .attr("class", "arc");

  g.append("path")
      .attr("d", arc)
      .style("fill", function(d) { return color(d.data.type); });

  g.append("text")
      .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
      .attr("dy", ".35em")
      .attr('class', 'pie-text')
      .style("text-anchor", "middle")
      .text(function(d) { return d.data.type; });

}

App.prototype._partyLinePie = function() {
  var self = this;

  var width = 150,
      height = 150,
      radius = Math.min(width, height) / 2;

  var color = d3.scale.ordinal()
      .range(["#4DB8F6", "#2479A9", "#98D4F7", "#666556", "#FFB90A", "#d0743c", "#ff8c00"]);
  var arc = d3.svg.arc()
      .outerRadius(radius - 10)
      .innerRadius(0);

  var pie = d3.layout.pie()
      .sort(null)
      .value(function(d) { return d.count; });

  var svg = d3.select("#pie-chart-party-line").append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  var data = [];
  for ( var d in this.partyLine ) {
    if (self.partyLine[d] > 0) {
      var obj = {"type": d, "count": self.partyLine[d]};
      data.push(obj);
    }
  }
  
  data.forEach(function(d) {
    d.count = +d.count;
  });

  var g = svg.selectAll(".arc")
      .data(pie(data))
    .enter().append("g")
      .attr("class", "arc");

  g.append("path")
      .attr("d", arc)
      .style("fill", function(d) { return color(d.data.type); });

  g.append("text")
      .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
      .attr("dy", ".35em")
      .attr('class', 'pie-text')
      .style("text-anchor", "middle")
      .text(function(d) { return d.data.type; });

}