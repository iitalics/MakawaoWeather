/* display */
let svg;
let backColor = "#fff"

/* geometry */
let width = 900;
let height = 600;
let boundsX = [60, 840];
let boundsY = [45, 530];

/* scales */
let dayX = d3.scaleLinear()
  .domain([0, 30])
  .range([boundsX[0]+12, boundsX[0]+12 + 30*24]);
let graphY = config => {
  return d3.scaleLinear()
    .domain(config.scale)
    .range([boundsY[1], boundsY[0]]);
};

/* data */
let monthIndex, mode;
let monthNames = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct".split(" ");
let currentDataXY;

/* hardcoded data (e.g. for jsfiddle) */
/* retrieve data using Ajax if this is left uninitialized */
let hardcoded;


function initWeatherGraph () {
  /* create SVG */
  svg = d3.select("#vis").append("svg");
  svg.style("background-color", backColor);
  svg.attr("width", width)
    .attr("height", height)
    /* translate to avoid anti-aliasing */
    .attr("transform", "translate(-.5,-.5)");

  /* create bounding box */
  let ctx = d3.path();
  d3.line().context(ctx)([
    [boundsX[0], boundsY[0]],
    [boundsX[0], boundsY[1]],
    [boundsX[1], boundsY[1]]]);

  /* create tick marks */
  for (let i = 0; i < 31; i++) {
    ctx.moveTo(dayX(i), boundsY[1] - 4);
    ctx.lineTo(dayX(i), boundsY[1] + 4);
  }

  svg.append("path")
    .attr("stroke", "#888")
    .attr("fill", "none")
    .attr("d", ctx.toString());

  /* make labels */
  let lbls = svg.append("g").classed("labels", true);
  for (let i = 0; i < 31; i++) {
    let x = dayX(i);
    let y = boundsY[1] + 10;
    lbls.append("g")
      .attr("transform", "translate("+x+","+y+")")
      .append("text")
        .attr("font-family", "sans-serif")
        .attr("font-size", 12)
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-45)")
        .attr("cursor", "default")
        .text("Day " + (i+1));
  }

  /* graph will be rendered here */
  svg.append("g").classed("interact--bot", true);
  svg.append("g").classed("graph", true);
  svg.append("g").classed("interact--top", true);

  /* event handlers: */
  d3.select(".monthSel").on("change", function () {
    /* change month */
    monthIndex = d3.select(".monthSel")
      .property("selectedIndex");
    loadSelectedGraph();
  });
  d3.selectAll(".modeSel").on("click", _ => {
    /* change mode */
    mode = d3.selectAll(".modeSel")
      .filter(function () { return d3.select(this).property("checked"); })
      .property("value");
    loadSelectedGraph();
  });

  {
    let last_i = null;
    d3.select("svg").on("mousemove", _ => {
      let mx = d3.mouse(svg.node())[0];
      let i = Math.round(dayX.invert(mx));
      if (!currentDataXY) return;

      i = Math.max(i, 0);
      i = Math.min(i, currentDataXY.length-1);

      if (last_i !== i) {
        interactMove(prevConfig, currentDataXY[i], i, last_i);
        last_i = i;
      }
    });
  }

  /* initialize, and show */
  monthIndex = 9; // october
  mode = "rain";
  loadSelectedGraph();
}

let configs = {
  rain: { color: "#15f", scale: [-0.1, 4.1], format: v => d3.format(".2")(v) + "\"" },
  temp: { color: "#f40", scale: [30, 100], format: v => d3.format(".3")(v) + "\xb0F" },
};

function loadSelectedGraph () {
  /* auto-set controls */
  d3.select(".monthSel").property("value", monthNames[monthIndex]);
  d3.select(".modeSel[value=" + mode + "]").property("checked", true);

  if (configs.hasOwnProperty(mode))
    loadGraph(mode, configs[mode]);
}

function loadGraph (file, config) {
  let callback = (err, res) => {
    if (err) {
      console.error("error loading `%s': ", file, err);
      return;
    }
    return initGraph(res[monthIndex], config);
  };
  /* request JSON or use hardcoded values */
  if (hardcoded) {
    callback(null, hardcoded[file]);
  }
  else {
    d3.json("data/" + file + ".json", callback);
  }
}




function initGraph (data, config) {
  /* abort if no data */
  if (data.length === 0) {
    return;
  }

  /* we pass 'graph' as a parameter to enable
   * the possibility of overlayed graphs */
  let graph = svg.select(".graph");
  if (data[0] instanceof Array)
    doGraph(graph, data, config, barGraph);
  else
    doGraph(graph, data, config, lineGraph);
  interactReset();
}

/* transition data: */
let DURATION = 400;
let EASE = d3.easeCubicInOut;

/* generite graph display. 'api' refers to one of
 *  the #api# structures defined below this function */
let prevConfig = null;
function doGraph (graph, dataY, config, api) {
  if (config !== prevConfig) {
    /* remove old stuff */
    svg.select(".graph").selectAll("*").remove();
    prevConfig = config;
    interactReset();
  }

  let dataXY = currentDataXY = d3.zip(d3.range(dataY.length), dataY);
  let objs = graph.selectAll(".graphObj")
    .data(dataXY);

  /* use enter()/exit() to initialize graph objects
   *  for each data point */
  objs.exit()
    .remove();
  objs.enter()
    .append("g").classed("graphObj", true)
      .call(sel => api.makeObjects(sel, config))
      /* automatically move fresh graph objects */
      .call(sel => api.moveObjects(sel, config))
    .merge(objs)
    .transition("graphTR")
      .duration(DURATION)
      .ease(EASE)
      /* transition old graph objects */
      .call(tr => api.moveObjects(tr, config));

  /* draw dotten lines for each limit */
  if (api.limits) {
    let values = api.limits.map(l => l.value(dataY));
    let makeLimits = sel => {
      /* create dotted line, and text */
      sel.append("line")
        .attr("x1", boundsX[0])
        .attr("x2", boundsX[1])
        .attr("stroke", config.color)
        .attr("stroke-dasharray", "2, 6");
      sel.append("text")
        .attr("fill", "#000")
        .attr("font-family", "sans-serif")
        .attr("font-size", 12)
        .attr("text-anchor", "end")
        .attr("x", boundsX[1])
        .attr("y", -2)
    };
    let moveLimits = sel => {
      sel.attr("transform", d => "translate(0," + ~~graphY(config)(d.value) + ")");
    };

    let lims = graph.selectAll(".limitObj")
      .data(api.limits.map((l,i) => ({ value: values[i], text: l.text })));
    /* like before, use enter()/exit() to initialize
     *  graph objects for each data */
    lims.exit().remove();
    lims = lims.enter()
      .append("g").classed("limitObj", true)
        .call(makeLimits)
        .call(moveLimits)
      .merge(lims);
    lims
      .transition("limitTR")
        .delay(100) // delay, for effect
        .duration(DURATION)
        .ease(EASE)
        .call(moveLimits);
    lims.select("text")
      .text(d => d.text(d.value, config));
    /* move to front */
    lims.raise();
  }

  if (api.post)
    api.post(graph, dataXY, config);
}



/* INTERFACE: */
/* #api#.makeObjects(sel, config)
 *   create graph objects using selection
 *
 * #api#.moveObjects(sel, config)
 *   move graph objects using selection/transition
 *
 * #api#.post(graph, dataXY, config)
 *   [optional]
 *   execute this function after graph objects are created
 *
 * #api#.limits[]
 *   [optional]
 *   list of limits to show, e.g. highest/lowest, mean, median
 */

let lineGraph = {
  /* graph object is a little circle */
  makeObjects (sel, config) {
    sel.append("g")
      .classed("pt", true)
      .attr("stroke", config.color)
      .attr("fill", backColor)
      .append("circle")
        .attr("r", 3);
  },
  moveObjects (sel, config) {
    sel.attr("transform", d =>
      "translate("+dayX(d[0])+","+graphY(config)(d[1])+")");
  },

  /* store previous graph, for transitions */
  prevData: null,
  post (g, data, config) {
    /* delete old path */
    g.select(".linePath")
      .interrupt("graphTR")
      .remove();

    let prev = this.prevData || [];
    this.prevData = data;

    /* render curved path, returning SVG path move commands */
    let renderPath = (data) => {
      let ctx = d3.path();
      d3.line()
        .context(ctx)
        .curve(d3.curveCatmullRom)
        .x(d => dayX(d[0]))
        .y(d => graphY(config)(d[1]))
        (data);
      return ctx.toString();
    };

    /* create and animate a path for the adata */
    let linePath = g.append("path")
      .classed("linePath", true)
      .lower()
      .attr("stroke", config.color)
      .attr("fill", "none")
      .transition("graphTR")
        .duration(DURATION)
        .ease(EASE)
        .attrTween("d", _ => {
          let interp = d3.interpolate(prev, data);
          return t => renderPath(interp(t));
        });
  },

  /* high/mean.  we don't have low because low rainfall is always 0 */
  limits: [
    { text (v, config) { return "High: " + config.format(v); },
      value (dataY) { return d3.max(dataY); } },
    { text (v, config) { return "Mean: " + config.format(v); },
      value (dataY) { return d3.mean(dataY); } },
  ],
};

/* "bar" graph consists of high & low values,
 *  shown as bars with a line connecting them */
let barGraph = {
  makeObjects (sel, config) {
    sel.append("line")
      .classed("mid", true)
      .attr("stroke", config.color);

    sel.append("g")
      .classed("pt lo", true)
      .attr("stroke", config.color)
      .attr("fill", backColor)
      .append("rect")
        .attr("x", -6)
        .attr("y", -3)
        .attr("width", 12)
        .attr("height", 3);

    sel.append("g")
      .classed("pt hi", true)
      .attr("stroke", config.color)
      .attr("fill", backColor)
      .append("rect")
        .attr("x", -6)
        .attr("width", 12)
        .attr("height", 3);
  },

  moveObjects (sel, config) {
    /* NOTE: ~~x = Math.trunc(x)  when 'x' fits in 32 bit integer */
    let y = graphY(config);
    sel.select(".hi")
      .attr("transform", d => "translate(" + dayX(d[0]) + "," + ~~y(d[1][0]) + ")");
    sel.select(".lo")
      .attr("transform", d => "translate(" + dayX(d[0]) + "," + ~~y(d[1][1]) + ")");
    sel.select(".mid")
      .attr("x1", d => dayX(d[0]))
      .attr("x2", d => dayX(d[0]))
      .attr("y1", d => ~~y(d[1][0]))
      .attr("y2", d => ~~y(d[1][1]));
  },
  post () { lineGraph.prevData = null; },

  limits: [
    { text (v, config) { return "High: " + config.format(v); },
      value (dataY) { return d3.max(dataY.map(d => d[0])); } },
    { text (v, config) { return "Low: " + config.format(v); },
      value (dataY) { return d3.min(dataY.map(d => d[1])); } },
  ],
};



function interactReset () {
  d3.select(".interact--bot").selectAll("*").remove();
  d3.select(".interact--top").selectAll("*").remove();
}

function interactMove (config, d, i, last_i) {
  let ibot = d3.select(".interact--bot");
  let itop = d3.select(".interact--top");

  let panel = ibot.selectAll(".panel")
    .data([true]);
  panel = panel.enter()
    .append("rect").classed("panel", true)
    .attr("y", boundsY[0])
    .attr("width", dayX(1) - dayX(0))
    .attr("height", boundsY[1] - boundsY[0])
    .attr("opacity", 0.1)
    .merge(panel);

  panel.interrupt("moveTR")
    .attr("fill", config.color)
    .attr("x", dayX(i-.5));

  let ptData = d[1];
  if (!(ptData instanceof Array)) ptData = [ptData];

  let obj = d3.selectAll(".graphObj")
    .filter((_,j) => j === i);

  let labels = itop.selectAll(".label")
    .data(ptData);
  labels.exit().remove();
  labels = labels.enter()
    .append("text")
      .classed("label", true)
      .attr("font-family", "sans-serif")
      .attr("font-size", 15)
      .attr("stroke", "none")
      .attr("text-anchor", "middle")
      .style("cursor", "default")
    .merge(labels);

  labels
    .attr("fill", "#000")
    .attr("x", dayX(i))
    .attr("y", (d,k) => graphY(config)(d) - 6 + k*24)
    //.style("filter", "drop-shadow(2px 2px 0px #000)")
    .text(config.format);
}



/* go! */
setTimeout(initWeatherGraph, 0);
