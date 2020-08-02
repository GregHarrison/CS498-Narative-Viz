var margin = {top:40, bottom:10, left:160, right:160};
var width = 960 - margin.left - margin.right;
var height = 640;
const transitionTime = 10000;   // The ammount of time the trasntions should last
var currentYear = 2013;
var colors =  d3.scaleOrdinal(d3.schemeCategory10); // The color scale

d3.select("#yearText").text(currentYear + " California Wildfires ");

// Create svg for map
var map = d3.select("#map")
  .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top);

var cal = d3.json("https://raw.githubusercontent.com/GregHarrison/CS498-Narrative-Vis/master/ca.json");
var cal_fires = d3.csv("https://raw.githubusercontent.com/GregHarrison/CS498-Narrative-Vis/Martini-Glass/Cal_Fires.csv");

Promise.all([cal, cal_fires]).then(function(values) {
  
  var parseTime = d3.timeParse("%m/%d/%Y");
  var fireDateParse = d3.timeFormat("%b %d, %Y");

  // Parse data
  values[1].forEach(function(d) {
    d.AcresBurned = +d.AcresBurned;
    d.RunSumAcresBurned = +d.RunSumAcresBurned;
    d.Started = parseTime(d.Started);
    d.Extinguished = parseTime(d.Extinguished);
  })

  // create list of years
  var years = d3.map(values[1], function(d) { return d.ArchiveYear; }).keys().sort(d3.descending);

  var projection = d3.geoConicEqualArea().parallels([34, 40.5]).rotate([120,0]).fitSize([width,height], values[0]);
  
  var path = d3.geoPath().projection(projection);

  map.append("g")
    .attr("id", "caliMap")
    .attr("transform", "translate("+margin.left+","+margin.top+")")
    .append("path")
      .attr("d", path(values[0]))
      .attr("fill", "#e5e5e5")
      .attr("stroke", "black")
      .attr("stroke-width", ".5px");
  
  map.append("g")
    .attr("id", "fireCircles")
    .attr("transform", "translate("+margin.left+","+margin.top+")");
  
  // Create a scale to translate a year into the transition time
  var transitionScale = d3.scaleLinear()
    .domain([0,365])
    .range([0,transitionTime]);

  // Scale x-axis. This is a constant in order to keep that axis from changing
  // while the data changes years.
  var x = d3.scaleTime()
    .domain([new Date(2013,00,01,00,00,00), new Date(2013,11,31,23,59,59)])
    .range([0, width]);
 
  // Scale y-axis
  var y = d3.scaleLinear()
    .domain([0, d3.max(values[1], function(d) { return d.RunSumAcresBurned; })])
    .range([height/2 - margin.bottom, 0])
    .nice();
  
  // Create SVG element for chart
  var chart = d3.select("#chart")
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height/2 + margin.top)
      .append("g")
        .attr("id", "lineChart")
        .attr("transform","translate(0, "+2*margin.bottom+")")

  // Add y axis
  chart.append("g")
    .attr("id", "yAxis")
    .attr("class", "grid")
    .attr("transform", "translate("+margin.left+", 0)")
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(d3.format(".2s")))
    .append("text")
      .attr("class", "axis-title")
      .attr("y", 0 - 40)
      .attr("x", 0 - (height/4))
      .attr("transform", "rotate(-90)")
      .text("Cumulative Sum of Acres Burned");
  
  // Add x axis
  chart.append("g")
      .attr("id", "x")
      .attr("transform", "translate("+margin.left+", "+(height/2 - margin.bottom)+")")
      .call(d3.axisBottom(x)
        .ticks(12)
        .tickFormat(d3.timeFormat("%b")));

  // Create an element for the line
  chart.append("g")
      .attr("id", "line")
      .attr("transform", "translate("+margin.left+", 0)");
    


  /** Function assigns a dateFromSliderPosition for annotations based on where fire occured.
      @param Longitude  The longitude dateFromSliderPosition of the fire.
      @param Latitude   The lotitude dateFromSliderPosition of the fire.
      @param annoWidth  The width of the annotation.
      @return   Function returns an array containing, in SVG coordinates, the x-coordinate
        of the annotation, the y-coordinate of the annotation, the x-coordinate of where
        the line pointing to the annotation text will end, the x-coordinate of where
        the line pointing to the annotation text will end, and the appropriate text
        allignment (left or right) of the annotation text.*/ 
  function annoPosition(Longitude, Latitude, annoWidth) {
    var xOffset = 160;  // X offset for positioning annotations
    var yOffset = 30;   // Y offset for positioning annotations
    var annoLong = -122.5;
    var annoLat = 36.5;

    // If fire in far north
    if (Latitude > 40.5) {
      return [projection([Longitude,Latitude])[0] + xOffset + 30, projection([Longitude,Latitude])[1] - yOffset - 20, 
        projection([Longitude,Latitude])[0] + xOffset + 25, projection([Longitude,Latitude])[1] - yOffset - 10, "left"]
    } 
    // If fire in Southeast
    else if (Latitude <= annoLat && Longitude > annoLong) {
      return [projection([Longitude,Latitude])[0] - xOffset - 150, projection([Longitude,Latitude])[1] + yOffset,
        projection([Longitude,Latitude])[0] - xOffset - 150 + (annoWidth + 3), 
        projection([Longitude,Latitude])[1] + yOffset + 8, "right"]
    } 
    // If fire in Northwest
    else if (Latitude > annoLat && Longitude <= annoLong) {
      return [projection([Longitude,Latitude])[0] - (xOffset + 100), projection([Longitude,Latitude])[1] + 3*yOffset,
        projection([Longitude,Latitude])[0] - (xOffset + 100) + (annoWidth + 3), 
        projection([Longitude,Latitude])[1] + 3*yOffset + 8, "right"]
    } 
    // If fire in Northeast
    else {
      return [projection([Longitude,Latitude])[0] + xOffset, projection([Longitude,Latitude])[1] - yOffset, 
        projection([Longitude,Latitude])[0] + xOffset - 5, projection([Longitude,Latitude])[1] - yOffset + 10, "left"]
    }
  }



  /** Function will display fires on the map as circles with size reltaive to the 
      amount of acres burned. 
      @param year  The year to display data for. */
  function drawCirclesAnimated(year) {
    
    var yearStartDate = new Date(year,00,00,00,00,00);
    var yearEndDate = new Date(year,11,31,23,59,59);
    var annoWidth = 250
    var annoHeight = 78
    
    // Filter for only major fires
    var majorFires = values[1].filter(d => d.AcresBurned > 77000).filter(d => d.ArchiveYear==year);
    
    // Create a conversion to set the radious of circle to be proportional to the acres burned
    var acres2radious = d3.scaleSqrt()
      .domain([0, d3.max(values[1], function(d) { return d.AcresBurned; } )])
      .range([1,35]);
  
    // Create circles at latitude and longitude location of each fire.
    // Circles spawn when fire started and last for time interval of fire
    d3.select("#fireCircles")
      .selectAll("circle")
      .data(values[1].filter(function(d) { return d.ArchiveYear==year; }))
      .enter()
      .append("circle")
        .attr("cx", function(d) { return projection([d.Longitude,d.Latitude])[0]; })
        .attr("cy", function(d) { return projection([d.Longitude,d.Latitude])[1]; })
        .attr("fill", colors(year % 7))
        .transition()
          .delay(function(d) { return transitionScale(d3.timeDay.count(yearStartDate, d.Started)); })
          .duration(function(d) { return transitionScale(d3.timeDay.count(d.Started, d.Extinguished)); })
          .attr("r", function(d) { return acres2radious(d.AcresBurned); })
          .attr("opacity", 1)
        .transition()
          .duration(0)
          .attr("opacity", .35);
    
    // Create a foreign object with embedded html to display detail of major fires
    d3.select("#fireCircles")
      .selectAll("foreignObject")
      .data(majorFires)
      .enter()
      .append("foreignObject")
        .style("text-align", d =>annoPosition(d.Longitude, d.Latitude, annoWidth)[4])
        .attr("x", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[0])
        .attr("y", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[1])
        .attr("width", annoWidth)
        .attr("height", annoHeight)
        .html(d => "<b>" + d.Name + "</b>" 
              + "<br>" + fireDateParse(d.Started) + " - " + fireDateParse(d.Extinguished)
              + "<br>Acres Burned: " + d.AcresBurned + "<br>Structures Destroyed: " + d.StructuresDestroyed)
        .attr("opacity", 0)
        .transition()
          .delay(d => transitionScale(d3.timeDay.count(yearStartDate, d.Started)))
          .duration(0)
          .attr("opacity", 1);

    // Create lines to point from annotation to fire center
    d3.select("#fireCircles")
      .selectAll("line")
      .data(majorFires)
      .enter()
      .append("line")
        .attr("x1", d => projection([d.Longitude,d.Latitude])[0])
        .attr("y1", d => projection([d.Longitude,d.Latitude])[1])
        .attr("x2", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[2])
        .attr("y2", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[3])
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
        .attr("opacity", 0)
        .transition()
          .delay(d => transitionScale(d3.timeDay.count(yearStartDate, d.Started)))
          .duration(0)
          .attr("opacity", 1);
  }



  /** Function will display fires on the map as circles with size reltaive to the 
      amount of acres burned. 
      @param year  The year to display data for. */
  function drawCircles(data, year) {
    var annoWidth = 250
    var annoHeight = 78

    // Filter for only major fires
    var majorFires = data.filter(d => d.AcresBurned > 77000);

    // Create a conversion to set the radious of circle to be proportional to the acres burned
    var acres2radious = d3.scaleSqrt()
      .domain([0, d3.max(values[1], function(d) { return d.AcresBurned; } )])
      .range([1,35]);
  
    // Create circles at latitude and longitude location of each fire.
    d3.select("#fireCircles")
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
        .attr("cx", d => projection([d.Longitude,d.Latitude])[0])
        .attr("cy", d => projection([d.Longitude,d.Latitude])[1])
        .attr("fill", colors(year % 7))
        .attr("r", d => acres2radious(d.AcresBurned))
        .attr("opacity", 0.7);

    // Create a foreign object with embedded html to display detail of major fires
    d3.select("#fireCircles")
      .selectAll("foreignObject")
      .data(majorFires)
      .enter()
      .append("foreignObject")
        .style("text-align", d =>annoPosition(d.Longitude, d.Latitude, annoWidth)[4])
        .attr("x", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[0])
        .attr("y", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[1])
        .attr("width", annoWidth)
        .attr("height", annoHeight)
        .html(d => "<b>" + d.Name + "</b>" 
              + "<br>" + fireDateParse(d.Started) + " - " + fireDateParse(d.Extinguished)
              + "<br>Acres Burned: " + d.AcresBurned + "<br>Structures Destroyed: " + d.StructuresDestroyed)
    
    // Create lines to point from annotation to fire center
    d3.select("#fireCircles")
      .selectAll("line")
      .data(majorFires)
      .enter()
      .append("line")
        .attr("x1", d => projection([d.Longitude,d.Latitude])[0])
        .attr("y1", d => projection([d.Longitude,d.Latitude])[1])
        .attr("x2", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[2])
        .attr("y2", d => annoPosition(d.Longitude, d.Latitude, annoWidth)[3])
        .attr("stroke", "black")
        .attr("stroke-width", "1px")
  }




  /** Function will draw an animated line chart showing the cumulative amount of 
      acres burned over a given year. 
      @param year  The year to display data for. 
      @param data  The data to be used to draw the circles.
      @param transTime  The desired time to of animations in milliseconds.*/
  function drawChart(year, data = values[1].filter(d => d.ArchiveYear==year), transTime = transitionTime) {
    
    var yearStartDate = new Date(year,00,01,00,00,00);
    var yearEndDate = new Date(year,11,31,23,59,59);

    // Scale for the x-coordinates
    var xCoords = d3.scaleTime()
      .domain([yearStartDate, yearEndDate])
      .range([0, width]);

    var line = d3.line()
      .x(d => xCoords(d.Started))
      .y(d => y(d.RunSumAcresBurned));

    var path = d3.select("#line")
      .append("path")
      .datum(data)
      .attr("class", "line")
      .attr("id", "y" + year)
      .attr("d", line)
      .attr("stroke", colors(year % 7));

    var totalLength = path.node().getTotalLength();

    path.attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .duration(transTime)
        .attr("stroke-dashoffset", 0);
  }
   



  var slider = d3.select("#sliderDiv")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", 80)
    .append("g")
      .attr("transform", "translate("+margin.left+", 30)")
      .attr("id", "slider");
  

        

  /** Funtion adds a slider underneath the chart that can be used to filter
      the date displayed. 
      @param year  The current year being displayed. This to be used to 
        scale the slider dimensions to. */
  function appendSlider(year) {
    var yearStartDate = new Date(year,00,01,00,00,00);
    var yearEndDate = new Date(year,11,31,23,59,59);
    
    var sliderScale = d3.scaleTime()
      .domain([yearStartDate, yearEndDate])
      .range([0, width])
      .clamp(true);

    slider.append("line")
      .attr("class", "sliderLine")
      .attr("x1", 0)
      .attr("x2", width)
      .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-inset")
        .attr("stroke", colors(year % 7))
      .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-overlay")
      .call(d3.drag()  
        .on("drag", dragged)
        .on("end", function() {
          var sliderPosition = d3.event.x;
          var dateFromSliderPosition = sliderScale.invert(sliderPosition);
          var data = values[1].filter(d => d.ArchiveYear==year).filter(d => d.Started <= dateFromSliderPosition);
          var sumAcresBurned = d3.sum(data, d => d.AcresBurned);

          // Clear the currently displayed line circles and annotations
          d3.select("#line").selectAll("*").remove();
          d3.select("#fireCircles").selectAll("*").remove();

          // Move handle to dateFromSliderPosition dragged to
          handle.attr("cx", sliderScale(dateFromSliderPosition));
        
          // Move labels to handle dateFromSliderPosition
          dateLabel.attr("x", sliderScale(dateFromSliderPosition))
            .text(fireDateParse(dateFromSliderPosition));
          
          acresBurnedLabel.attr("x", sliderScale(dateFromSliderPosition))
            .text("Total Burned: " + sumAcresBurned + " Acres");

          drawChart(year, data, 10);
          drawCircles(data, year);
        })
      );
  
    function dragged() {
      var sliderPosition = d3.event.x;
      var dateFromSliderPosition = sliderScale.invert(sliderPosition);
      var data = values[1].filter(d => d.ArchiveYear==year).filter(d => d.Started <= dateFromSliderPosition);
      var sumAcresBurned = d3.sum(data, d => d.AcresBurned);
      
      // Move handle to dateFromSliderPosition dragged to
      handle.attr("cx", sliderScale(dateFromSliderPosition));
        
      // Move label to handle dateFromSliderPosition
      dateLabel.attr("x", sliderScale(dateFromSliderPosition))
        .text(fireDateParse(dateFromSliderPosition));

      acresBurnedLabel.attr("x", sliderScale(dateFromSliderPosition))
        .text("Total Burned: " + sumAcresBurned + " Acres");
    }

    var handle = slider.insert("circle", ".track-overlay")
      .attr("class", "handle")
      .attr("r", "8px");
        
    var dateLabel = slider.append("text")  
      .attr("class", "sliderLabel")
      .text(fireDateParse(yearStartDate))
      .attr("transform", "translate(0,"+25+")")
    
    var acresBurnedLabel = slider.append("text")  
      .attr("class", "sliderLabel")
      .text("Total Burned: " + 0 + " Acres")
      .attr("transform", "translate(0,"+(-20)+")")
  }




  /** Update the page for the appropriate year.
      @param year  The year to display data for. */
  function updateDisplayAnimated(year) {

    // Remove all circles and annotations from the map
    d3.select("#fireCircles").selectAll("*").remove();
    
    // lower opacity of lines outside of current year
    d3.select("#line").selectAll("*").attr("opacity", 0.3);
    
    // Update header with current year
    d3.select("#yearText").text(year + " California Wildfires ");

    // Draw circles for chosen year
    drawCirclesAnimated(year);

    // Draw line chart for chosen year
    drawChart(year);
  }




  /** Update the page for the appropriate year.
      @param year  The year to display data for. */
  function updateDisplay(year) {

    // Remove all circles and annotations from the map
    d3.select("#fireCircles").selectAll("*").remove();
    
    // lower opacity of lines outside of current year
    d3.select("#line").selectAll("*").remove();
    
    // Update header with current year
    d3.select("#yearText").text(year + " California Wildfires ");

    drawChart(year);
    drawCirclesAnimated(year);

    d3.select("#slider").selectAll("*").remove();
    appendSlider(year);

  }




  /** Function replaces the next button with a selector so that the viewer
      can go back and look at data from a specific year. */
  function changeButtons() {
    d3.select("#nextButton").remove();
      
    d3.select("#filters").append("select").attr("id", "yearButton")
      .selectAll("myOptions")
        .data(years)
      .enter()
        .append("option")
          .text(d => d)
          .attr("value", d => d)

    d3.select("#yearButton")
      .style("cursor", "pointer")
      .on("change", function() {
        var selection = d3.select(this).property("value");
        updateDisplay(selection);
        currentYear = selection;
      });
  }




  // Initialize map with 2013 data
  drawCirclesAnimated(currentYear);
  
  // Initialize chart with 2013 data
  drawChart(currentYear);

  d3.select("#nextButton")
    .style("cursor", "pointer")
    .on("click", function() {
      var nextYear = currentYear + 1;
      updateDisplayAnimated(nextYear);
      currentYear = nextYear;
      if (currentYear == 2019) {
        changeButtons();
      }
    });
});