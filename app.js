var svg, margin, width, height;
var spaceBarPressCount = 0;

const population_growth_line_color = "#fca311"
const deaths_line_color = "#B13507"
const births_line_color = "#3360a9"
const tooltip_background_color = "#f2f4f7"


const line_width = 1;
const line_dot_radius = 1.5;
const tooltip_dot_radius = 5;
const line_dasharray = ""
const forecast_line_width = "1.5"
const forecast_line_dasharray = "3,4"
const default_filter_code = "OWID_WRL";
const default_line_draw_Interval = 10;
var currentGroup;
var footerCont;
const baseTransformGroupName = "baseTransformGroup"
var countries;
var currentCode;
var dataWithForecast;

const storyHeaders = {
    "population": "World's Population Growth",
    "birth": "How many are born each year?",
    "death": "How many die each year?",
    "story-summary": "What does this mean for world population growth?",
    "explore": "Explore by Yourself"
}

const storyMessages = {
    "population-1": "Back in the history in year 1950, the absolute increase of population was around 47 milion, and it was peaked " +
        "in the late 1980s to over 90 million additional people each year. And it stayed high until recently. ",
    "population-2": "The change in the world population is determined by two major metrics: ",
    "population-3": " the number of babies born, and the number of people dying. ",
    "population-4": "So to understand the likely trajectory of population growth, let's see how births and deaths are changing... ",
    "birth-1": "Back in history, in year 1950, there were around 97 million births and it increased to approx 138 million births per year in late 1980s." +
        "Even now it's the same approx 140 million births - 43 million more than back in 1950. ",
    "birth-2": "As per medium variant of UN projections the yearly number of births will remain at around 140 million " +
        "per year over the coming decades. It is then expected to slowly decline in the second-half of the century. ",
    "death-1": "The number of deaths was around same since 1950 to late 1990s. And it has slightly increased since then. ",
    "death-2": 'As the world population ages, the annual number of deaths is expected to continue to ' +
        'increase in the coming decades until it reaches a similar annual number as global births towards the end of the century. ',
    "st-1": "As per medium variant of UN projections shown above, the number of births is expected to slowly fall and the number of deaths to rise, the global population growth rate will continue to fall.",
    "st-2": "As per UN projection, this is when the world population growth will stop to increase in the future...",
    "explore": 'To explore, it is possible to change the above view by changing the "Change country or world region" filter to any country or world region ' +
        'and a tooltip is provided on mouse hover in the chart above. '
};

const storyLineContent = "Will the world's population growth ever come near to an end?";
const footerContContent = 'Press [space bar] to continue.';
const footerReplayContent = 'Replay';
const footerDsr = 'Data Source & References';
const dsrLink = 'https://ourworldindata.org/future-population-growth#births-and-deaths';


//Formatting Utilities
const parseDate = string => d3.utcParse("%Y-%m-%d")(string);
const parseNA = string => (string === "NA" ? undefined : string);
const tickFormat = (string, d) => d3.format(string)(d / 10);
function uniqueCountries(data) {
    const result = [];
    const map = new Map();
    for (const item of data) {
        if (!map.has(item.code)) {
            map.set(item.code, true);
            result.push({
                code: item.code === "" ? item.entity : item.code,
                entity: item.entity
            });
        }
    }
    return result;
}

function formatTicks(d) {
    d = d3.format(".2f")(d);

    if (d < 1000000 && d > (1000000 * -1)) {
        return d;
    }

    return d3
        .format('~s')(d)
        .replace('k', ',000')
        .replace('M', ' million')
        .replace('G', ' billion')
        .replace('T', ' trillion');
}


function formatAndCombineData(csvData, popData) {
    var code = parseNA(csvData.country_code);
    var entity = parseNA(csvData.country_name);
    var year = +csvData.year;
    var births = +csvData.births;
    var forecast_births = +csvData.estimated_births;
    var deaths = +csvData.deaths;
    var forecast_deaths = +csvData.estimated_deaths;
    code = code === "" ? entity : code;

    var popRow = popData.find(d => d.year === year && d.code === code);
    var population_growth = +popRow.population_growth;
    var forecast_population_growth = +popRow.forecast_population_growth;

    return {
        code: code,
        entity: entity,
        year: +csvData.year,
        births: births === 0 ? forecast_births : births,
        deaths: deaths === 0 ? forecast_deaths : deaths,
        population_growth: population_growth === 0 ? forecast_population_growth : population_growth,
        isForecastYear: forecast_births > 0 && forecast_deaths > 0
    };
}

function formatPopulationGrowthData(csvData) {
    var code = parseNA(csvData.country_code);
    var entity = parseNA(csvData.country_name);

    return {
        code: code === "" ? entity : code,
        entity: parseNA(csvData.country_name),
        population_growth: +csvData.population_growth,
        forecast_population_growth: +csvData.population_growth_forecast,
        year: +csvData.year
    };
}

function filterDataByCode(d, code) {
    return d.filter(d => d.code === code);
}

function transitionSceneMessages() {
    if (spaceBarPressCount > 8) {
        return;
    }
    const otherScreenMsgs = d3.selectAll(`.screen-msg:not(.screen-msg${spaceBarPressCount})`);
    const currentScreenMsgs = d3.selectAll(`.screen-msg${spaceBarPressCount}`);
    otherScreenMsgs
        .transition()
        .duration(500)
        .style("opacity", 0)
        .style("display", "none")
        .on("end", () => {
            currentScreenMsgs
                .style("display", "block")
                .transition()
                .duration(500)
                .style("opacity", 1)
        }
        );
}

//Setup SVG
function initialSetup() {

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    var svgMargin = Math.min(viewportHeight, viewportWidth) * 0.05;
    svgWidth = viewportWidth - 2 * svgMargin;
    svgHeight = (viewportHeight - svgMargin) * 0.65;

    const aspectRatio = 16 / 9;
    const currentAspectRatio = svgWidth / svgHeight;

    if (currentAspectRatio > aspectRatio) {
        svgWidth = svgHeight * aspectRatio;
    } else {
        svgHeight = svgWidth / aspectRatio;
    }

    svg = d3.select("svg");
    svg.attr("width", svgWidth).attr("height", svgHeight);


    margin = {
        top: svgMargin * 1.5,
        left: svgMargin * 1.5,
        bottom: svgMargin * 1.5,
        right: svgMargin * 3.5
    }

    width = svgWidth - margin.left - margin.right;
    height = svgHeight - margin.top - margin.bottom;

    d3.selectAll(".flex-container").style("width", svgWidth + "px");
    d3.selectAll("h2").style("margin-top", Math.round(svgMargin / 4) + "px");

    return svg;
}

function populateCountriesFilter() {
    countries = uniqueCountries(data);
    d3.select("select").selectAll("option")
        .data(countries)
        .enter()
        .append("option")
        .text((d) => d.entity)
        .attr("value", (d) => d.code)
        .property("selected", (d) => d.code === default_filter_code);
}

//Draw
var baseTransformGroup;
var axes, leftAxis, bottomAxis, leftAxisLabel, bottomAxisLabel;
var vizQuestion;
var xScale, yScale;
var data;

//Axes
function drawAxes(baseGroup, data, xScale, yScale, yAxisText, xDataKey) {
    //remove any existing axes
    baseGroup.selectAll(".axes").remove();

    //draw
    axes = baseGroup.append("g").attr("class", "axes");
    leftAxis = axes.append("g").attr("class", "y-axis")
    bottomAxis = axes.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`);
    leftAxisLabel = leftAxis.append("text");
    bottomAxisLabel = bottomAxis.append("text");

    xData = data.map(d => d[xDataKey]);

    leftAxis.attr("opacity", 0)
        .call(d3.axisRight(yScale).tickSize(width).tickFormat(formatTicks))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-opacity", 0.3)
            .attr("stroke-dasharray", "1,3"))
        .call(g => g.selectAll(".tick text")
            .attr("x", -5)
            .attr("y", 0))
        .style("text-anchor", "end")
        .call(g => g.select(".domain").remove())

    bottomAxis.attr("opacity", 0).call(makeBottomAxis(xScale, xData))
        .selectAll(".tick text");

    bottomAxisLabel
        .attr("y", margin.bottom - 3)
        .attr("x", width / 2)
        .attr("dx", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "1.1em")
        .text(yAxisText);

    leftAxis.transition().duration(500).attr('opacity', 1);
    bottomAxis.transition().duration(500).attr('opacity', 1);
}


function transitionAxes(data, xScale, yScale, xDataKey) {
    xData = data.map(d => d[xDataKey]);
    leftAxis.transition().duration(500)
        .call(d3.axisRight(yScale).tickSize(width).tickFormat(formatTicks))
        .on("start", () => svg.select(".y-axis .domain").remove())
        .call(g => g.selectAll(".tick line")
            .attr("stroke-opacity", 0.3)
            .attr("stroke-dasharray", "1,3"))
        .call(g => g.selectAll(".tick text")
            .attr("x", -5)
            .attr("y", 0))
        .style("text-anchor", "end");

    bottomAxis.transition().duration(500).call(d3.axisBottom(xScale)
        .tickValues(d3.ticks(xData[0], xData[xData.length - 1], 5).concat(xScale.domain()))
        .tickFormat(d => d3.format(".0f")(d)));
}

function makeBottomAxis(xScale, xData) {

    return d3.axisBottom(xScale)
        .tickValues(d3.ticks(xData[0], xData[xData.length - 1], 5).concat(xScale.domain()))
        .tickFormat(d => d3.format(".0f")(d));
}


//Lines
function drawLine(baseGroup, data, xScale, yScale, xDataKey, yDataKey, color, width, dashArray, opacityValue) {

    var lineGroup = baseGroup.append("g").attr("class", "line-group");
    var linePathGroup = baseGroup.append("g").attr("class", "line-path-group").attr("opacity", 0);

    //Draw Line
    var lineGen = d3.line().x(d => { return xScale(d[xDataKey]) }).y(d => { return yScale(d[yDataKey]) });

    linePathGroup.append("path")
        .attr("fill", "none")
        .attr("stroke", "#ddd")
        .attr("stroke-width", width)
        .datum(data)
        .attr("d", lineGen);

    linePathGroup.append("path")
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", width)
        .attr("stroke-dasharray", dashArray)
        .datum(data)
        .attr("d", lineGen);

    linePathGroup = linePathGroup.transition().duration(500).attr('opacity', opacityValue);

    return { lineGroup, linePathGroup };
}

function drawDottedLine(baseGroup, data, xScale, yScale, xDataKey, yDataKey, color, width, dashArray, dotRadius, opacityValue) {

    var lineGroup = baseGroup.append("g").attr("class", "line-group");
    var linePathGroup = baseGroup.append("g").attr("class", "line-path-group").attr("opacity", 0);
    var dotGroup = baseGroup.append("g").attr("class", "dot-group").attr("opacity", 0);

    //Draw Line
    var lineGen = d3.line().x(d => { return xScale(d[xDataKey]) }).y(d => { return yScale(d[yDataKey]) });
    linePathGroup.append("path")
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", width)
        .attr("stroke-dasharray", dashArray)
        .datum(data)
        .attr("d", lineGen);

    dotGroup.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .style("fill", color)
        .style("stroke", color)
        .attr("cx", d => xScale(d[xDataKey]))
        .attr("cy", d => yScale(d[yDataKey]))
        .attr("r", dotRadius);

    linePathGroup.transition().duration(500).attr('opacity', opacityValue);
    dotGroup.transition().duration(500).attr('opacity', opacityValue);

    return { lineGroup, linePathGroup, dotGroup };
}

function transitionDottedLine(baseGroup, transitionData, xScale, yScale, xDataKey, yDataKey, color, width, transitionWidth, dashArray, dotRadius, transitionDashArray) {

    var lineGen = d3.line().x(d => { return xScale(d[xDataKey]) }).y(d => { return yScale(d[yDataKey]) });
    var linePathGroup = baseGroup.select("g .line-path-group");
    var dotGroup = baseGroup.select("g .dot-group");

    linePathGroup.selectAll("path")
        .transition()
        .duration(500)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", width)
        .attr("stroke-dasharray", dashArray)
        .attr("d", lineGen);

    dotGroup.selectAll("circle")
        .transition()
        .duration(500)
        .style("fill", color)
        .style("stroke", color)
        .attr("cx", d => xScale(d[xDataKey]))
        .attr("cy", d => yScale(d[yDataKey]))
        .attr("r", dotRadius);

    linePathGroup.append("path")
        .attr("fill", "none")
        .attr("stroke", "#ddd")
        .attr("stroke-width", transitionWidth)
        .datum(transitionData)
        .attr("d", lineGen)
        .attr("opacity", 0)
        .transition()
        .duration(600).attr("opacity", 1);

    linePathGroup.append("path")
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", transitionWidth)
        .attr("stroke-dasharray", transitionDashArray)
        .datum(transitionData)
        .attr("d", lineGen)
        .attr("opacity", 0)
        .transition()
        .duration(600).attr("opacity", 1);

    return { linePathGroup, dotGroup };
}

function hideLoadingMsg() {
    loadingMsg = d3.selectAll("#loading-msg");
    loadingMsg
        .style("display", "block")
        .style("opacity", 0)
        .transition()
        .style("opacity", 0);
}

function startStory() {
    storyLine = d3.selectAll("#story-line");
    storyLine
        .transition()
        .style("opacity", 0)
        .text("")
        .transition()
        .text(storyLineContent)
        .style("display", "block")
        .style("opacity", 1)
        .on("end", () => {
            setupFooter();
        });
}

function hideStoryLine(OnEnd) {
    storyLine = d3.select("#story-line");
    storyLine
        .transition()
        .duration(500)
        .style("opacity", 0)
        .on("end", function () {
            storyLine.style("opacity", 0)
            OnEnd();
        });
}

function DrawPopulationScene(code) {
    const dataWithForecast = filterDataByCode(data, code);
    const nonForecastData = dataWithForecast.filter(d => d.isForecastYear !== true);
    var baseTransformedGroup = svg.select(".baseTransformGroup");

    const popMax = d3.max(nonForecastData.map(d => d.population_growth));
    const years = nonForecastData.map(d => d.year);
    const yearMax = d3.max(years);
    const yMin = 40000000;

    xScale = d3.scaleTime().domain(d3.extent(years)).range([0, width]);
    yScale = d3.scaleLinear().domain([yMin, popMax]).range([height, 0]);

    baseTransformedGroup.select("g .population-line-chart").remove();
    var lineChartGroup = baseTransformedGroup.append("g").attr("class", "population-line-chart");

    reset_header("Population growth: The annual change of the population", "World");

    axes = drawAxes(lineChartGroup, nonForecastData, xScale, yScale, "Year", "year");
    populationLine = drawDottedLine(lineChartGroup, nonForecastData, xScale, yScale,
        "year", "population_growth", population_growth_line_color, line_width, line_dasharray, line_dot_radius, 1);

    //Label
    //Line Label
    populationLineLabel = populationLine.lineGroup.append("text").attr("class", "line-label").attr("opacity", 0);
    var pop_growth_yearmax = nonForecastData.find(d => d.year === yearMax).population_growth;

    populationLineLabel
        .attr("y", yScale(pop_growth_yearmax))
        .attr("x", xScale(yearMax + 1))
        .style("fill", population_growth_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Population")
        .append('tspan')
        .attr("y", yScale(pop_growth_yearmax) + 15)
        .attr("x", xScale(yearMax + 1))
        .text("Growth");
    populationLineLabel.transition().duration(500).attr('opacity', 1);

    //Annotation
    var peak_pop_annotaion = populationLine.lineGroup.append("g").attr("class", "peak-pop-growth-annotaion").attr("opacity", 0);
    var pop_growth_1987 = nonForecastData.find(d => d.year === 1987).population_growth;
    peak_pop_annotaion.append('ellipse')
        .attr('cx', xScale(1987)).attr('cy', yScale(pop_growth_1987))
        .attr('rx', 20).attr('ry', 10)
        .attr('fill', 'transparent')
        .attr('stroke-width', 2)
        .attr("stroke-dasharray", "4,2")
        .attr('stroke', '#959595');
    peak_pop_annotaion.append('text')
        .attr("y", yScale(pop_growth_1987) - 20)
        .attr("x", xScale(1983))
        .style('fill', '#959595')
        .style("font-size", "0.75em")
        .text('Peak in the late 1980s')
        .append("tspan")
        .attr("dy", "1.5em")
        .attr('x', xScale(1983));
    peak_pop_annotaion.transition().duration(500).attr('opacity', 1);

    add_2019_pop_annotation();

}

function showPopMsg(endAction) {
    const headerContent = d3.selectAll("#header-content");
    headerContent
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {

            headerContent.text(storyHeaders["population"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent1 = d3.selectAll("#msg-content-1");
    msgContent1
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent1.text(storyMessages["population-1"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent2
            .text(storyMessages["population-2"])
                .style("display", "block")
                .style("opacity", "1");
            msgContent2.append('tspan')
                .style("font-style", "italic")
                .text(storyMessages["population-3"]);
            msgContent2.append('tspan')
                .style("font-weight", "bold")
                .text(storyMessages["population-4"]);
        });
}

function reset_header(headerContent, entityName) {
    headerContent = `${headerContent}, ${entityName}`;

    d3.select("#chart-header-content")
        .text("")
        .style("display", "block")
        .style("opacity", "0");

    d3.select("#chart-header-content")
        .text("")
        .transition().duration(500)
        .text(headerContent)
        .style("display", "block")
        .style("opacity", "1");

    var subHeader = d3.select("#chart-sub-header-content");
    subHeader.text("");
}

function add_sub_header() {
    d3.select("#chart-header-content")
        .style("margin-bottom", "0.2em");
    var projectionString = "From 2020 onwards this chart shows the UN Population Division projections.";
    var subHeader = d3.select("#chart-sub-header-content");
    subHeader.text("");
    subHeader
        .style("font-size", "0.55em")
        .style("margin-top", "0.1em")
        .transition().duration(500)
        .text(projectionString)
        .style("display", "block")
        .style("opacity", "1");

}

function transition_header() {
    var subHeader = d3.select("#chart-sub-header-content");
    subHeader
        .transition().duration(500)
        .style("display", "block")
        .style("opacity", "1");
}

function add_2019_pop_annotation() {
    var annotation_2019 = populationLine.lineGroup.append("g").attr("class", "annotation-2019").attr("opacity", 0);
    annotation_2019
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2019))
        .attr("y1", 0)
        .attr("x2", xScale(2019))
        .attr("y2", height);

    var annotation_2019_text = annotation_2019.append("g")
        .append("text")
        .attr("y", -15)
        .attr("x", xScale(2019))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em");
    annotation_2019_text.append('tspan')
        .text("Stayed high until ");
    annotation_2019_text.append('tspan')
        .style("font-weight", "bold")
        .text("2019");

    annotation_2019.transition().duration(500).attr('opacity', 1);
}

function transitionOutPopulationScene(transitionDuration, afterTransition) {
    var baseTransformedGroup = svg.select(".baseTransformGroup");
    baseTransformedGroup.select("g .population-line-chart")
        .transition()
        .duration(transitionDuration)
        .remove()
        .on("end", afterTransition);
}

function drawBirthScene(code) {
    const dataWithForecast = filterDataByCode(data, code);
    const nonForecastData = dataWithForecast.filter(d => d.isForecastYear !== true);
    var baseTransformedGroup = svg.select(".baseTransformGroup");

    const yMax = d3.max(nonForecastData.map(d => d.births));
    const yMin = 90000000;
    const years = nonForecastData.map(d => d.year);
    const yearMax = d3.max(years);

    xScale = d3.scaleTime().domain(d3.extent(years)).range([0, width]);
    yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    baseTransformedGroup.select("g .birth-line-chart").remove();
    var lineChartGroup = baseTransformedGroup.append("g").attr("class", "birth-line-chart");

    axes = drawAxes(lineChartGroup, nonForecastData, xScale, yScale, "Year", "year");
    birthLine = drawDottedLine(lineChartGroup, nonForecastData, xScale, yScale,
        "year", "births", births_line_color, line_width, line_dasharray, line_dot_radius, 1);

    //chart header
    reset_header("Number of births per year", "World");

    //Label
    var lineLabel = birthLine.lineGroup.append("text").attr("class", "line-label").attr("opacity", 0);
    var birth_yearmax = nonForecastData.find(d => d.year === yearMax).births;

    lineLabel
        .attr("x", xScale(yearMax + 1))
        .attr("y", yScale(birth_yearmax) + 10)
        .style("fill", births_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Births")
    /* .append('tspan')
     .attr("x", xScale(yearMax+1))
     .attr("y", yScale(birth_yearmax) +30)
     .text("Births");*/
    lineLabel.transition().duration(500).attr('opacity', 1);

    //Annotation
    add_birth_annotation(nonForecastData);
}

function showBirthMsgs() {
    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent2.text(storyMessages["birth-2"])
                .style("display", "block")
                .style("opacity", "1");
        });
}

function showBirthMsg1() {
    const headerContent = d3.selectAll("#header-content");
    headerContent
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            headerContent.text(storyHeaders["birth"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent1 = d3.selectAll("#msg-content-1");
    msgContent1
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent1.text(storyMessages["birth-1"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0");
}

function add_birth_annotation(nonForecastData) {

    var lineChartGroup = baseTransformedGroup.select("g .birth-line-chart")
    var birth_annotation = lineChartGroup.append("g").attr("class", "birth-annotation");

    var late1980_birth_annotation = birth_annotation.append("g").attr("class", "peak-birth-annotation").attr("opacity", 0);
    var births_1988 = nonForecastData.find(d => d.year === 1988).births;
    late1980_birth_annotation.append('ellipse')
        .attr('cx', xScale(1988)).attr('cy', yScale(births_1988))
        .attr('rx', 20).attr('ry', 10)
        .attr('fill', 'transparent')
        .attr('stroke-width', 2)
        .attr("stroke-dasharray", "4,2")
        .attr('stroke', '#959595');
    var late1980_text = late1980_birth_annotation
        .append('text').attr("class", "ellipse-text")
        .style('fill', '#959595')
        .style("font-size", "0.75em");
    late1980_text.append('tspan')
        .attr("y", -25)
        .attr("x", xScale(1981))
        .style('font-weight', 'bold')
        .text("Lates 1980s: ")
    late1980_text.append('tspan')
        .text("Approx ")
        .append('tspan')
        .attr("y", -10)
        .attr("x", xScale(1981))
        .text("138 million births/year.");

    late1980_birth_annotation.transition().duration(500).attr('opacity', 1);

    var annotation_2019 = birth_annotation.append("g").attr("class", "annotation-2019").attr("opacity", 0);
    annotation_2019
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2019))
        .attr("y1", 0)
        .attr("x2", xScale(2019))
        .attr("y2", height);

    var annotation_text = annotation_2019.append("g")
        .append("text")
        .attr("y", -40)
        .attr("x", xScale(2019))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em");

    annotation_text.append('tspan')
        .style('font-weight', 'bold')
        .text("2019: ")
    annotation_text.append('tspan')
        .text("43 million more")
        .append('tspan')
        .attr("y", -10)
        .attr("x", xScale(2019))
        .text("than back in 1950.");

    annotation_2019.transition().duration(500).attr('opacity', 1);
}

function drawTransitionBirthScene(code) {
    const dataWithForecast = filterDataByCode(data, code);
    const nonForecastData = dataWithForecast.filter(d => d.isForecastYear !== true);
    const forecastData = dataWithForecast.filter(d => d.isForecastYear === true);
    var baseTransformedGroup = svg.select(".baseTransformGroup");
    var lineChartGroup = baseTransformedGroup.select("g .birth-line-chart");

    const yMax = d3.max(dataWithForecast.map(d => d.births));
    const yMin = 90000000;
    const years = dataWithForecast.map(d => d.year);
    const yearMax = d3.max(years);

    xScale = d3.scaleTime().domain(d3.extent(years)).range([0, width]);
    yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    //Remove Annotation
    var birth_annotation = baseTransformedGroup.select("g .birth-annotation")
    birth_annotation.remove();
    var lineLabel = baseTransformedGroup.select("g .line-label");
    lineLabel.remove();

    //Transition
    axes = transitionAxes(dataWithForecast, xScale, yScale, "year");
    transitionDottedLine(lineChartGroup, forecastData, xScale, yScale, "year", "births",
        births_line_color, line_width, forecast_line_width, line_dasharray, line_dot_radius, forecast_line_dasharray);

    //Label
    transition_birth_label(dataWithForecast);
    add_sub_header();

    //Annotation
    transition_birth_annotation();

}

function transition_birth_label(dataWithForecast) {
    const years = dataWithForecast.map(d => d.year);
    const yearMax = d3.max(years);
    lineLabel = birthLine.lineGroup.append("text").attr("class", "line-label").attr("opacity", 0);
    var birth_yearmax = dataWithForecast.find(d => d.year === yearMax).births;

    lineLabel
        .attr("x", xScale(yearMax + 1))
        .attr("y", yScale(birth_yearmax) + 10)
        .style("fill", births_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Births")
    /*   .append('tspan')
       .attr("x", xScale(yearMax+1))
       .attr("y", yScale(birth_yearmax) +30)
       .text("Births per year");*/
    lineLabel.transition().duration(500).attr('opacity', 1);
}

function transition_birth_annotation() {
    var birthChart = baseTransformedGroup.select("g .birth-line-chart")
    var birth_annotation = birthChart.append("g").attr("class", "birth-annotation");

    var annotation_2019 = birth_annotation.append("g").attr("class", "annotation-2019").attr("opacity", 0);
    annotation_2019
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2019))
        .attr("y1", 0)
        .attr("x2", xScale(2019))
        .attr("y2", height);

    var annotation_text = annotation_2019.append("g")
        .append("text")
        .attr("y", -40)
        .attr("x", xScale(2019))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em");
    annotation_text.append('tspan')
        .style('font-weight', 'bold')
        .text("2019: ")
    annotation_text.append('tspan')
        .text("Approx ")
        .append('tspan')
        .attr("y", -10)
        .attr("x", xScale(2019))
        .text("140 million births/year");
    annotation_2019.transition().duration(500).attr('opacity', 1);

    //2nd annotation
    var birth_decline_annotation = birth_annotation.append("g").attr("class", "births-decline").attr("opacity", 0);
    birth_decline_annotation
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2099))
        .attr("y1", 0)
        .attr("x2", xScale(2099))
        .attr("y2", height);

    var birth_decline_annotation_text = birth_decline_annotation.append("g")
        .append("text")
        .attr("y", -40)
        .attr("x", xScale(2099))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em");
    birth_decline_annotation_text.append('tspan')
        .style('font-weight', 'bold')
        .text("2099: ")
    birth_decline_annotation_text
        .append('tspan')
        .text("Projected to decline, ")
        .append('tspan')
        .attr("y", -10)
        .attr("x", xScale(2099))
        .text("Approx 125 million births/year.");
    birth_decline_annotation.transition().duration(500).attr('opacity', 1);
}

function transitionOutBirthScene(transitionDuration, afterTransition) {
    var baseTransformedGroup = svg.select(".baseTransformGroup");
    baseTransformedGroup.select("g .birth-line-chart")
        .transition()
        .duration(transitionDuration)
        .remove()
        .on("end", afterTransition);
}

function drawDeathScene(code) {
    const dataWithForecast = filterDataByCode(data, code);
    const nonForecastData = dataWithForecast.filter(d => d.isForecastYear !== true);
    var baseTransformedGroup = svg.select(".baseTransformGroup");

    const yMax = d3.max(nonForecastData.map(d => d.deaths));
    const years = nonForecastData.map(d => d.year);
    const yearMax = d3.max(years);
    const yMin = 40000000;

    xScale = d3.scaleTime().domain(d3.extent(years)).range([0, width]);
    yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    baseTransformedGroup.select("g .death-line-chart").remove();
    var lineChartGroup = baseTransformedGroup.append("g").attr("class", "death-line-chart");

    axes = drawAxes(lineChartGroup, nonForecastData, xScale, yScale, "Year", "year");
    deathLine = drawDottedLine(lineChartGroup, nonForecastData, xScale, yScale,
        "year", "deaths", deaths_line_color, line_width, line_dasharray, line_dot_radius, 1);

    //chart header
    reset_header("Number of deaths per year", "World");

    //Label
    var lineLabel = deathLine.lineGroup.append("text").attr("class", "line-label").attr("opacity", 0);
    var death_yearmax = nonForecastData.find(d => d.year === yearMax).deaths;
    lineLabel
        .attr("x", xScale(yearMax + 1))
        .attr("y", yScale(death_yearmax) + 10)
        .style("fill", deaths_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Deaths")
    lineLabel.transition().duration(500).attr('opacity', 1);
    //Annotation
    add_death_annotation()
}

function showDeathMsgs() {
    const msgContent1 = d3.selectAll("#msg-content-2");
    msgContent1
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent1.text(storyMessages["death-2"])
                .style("display", "block")
                .style("opacity", "1");
        });
}

function showDeathMsg1() {
    const headerContent = d3.selectAll("#header-content");
    headerContent
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            headerContent.text(storyHeaders["death"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent1 = d3.selectAll("#msg-content-1");
    msgContent1
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent1.text(storyMessages["death-1"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0");
}

function add_death_annotation() {

    var lineChartGroup = baseTransformedGroup.select("g .death-line-chart")
    var death_annotation = lineChartGroup.append("g").attr("class", "death-annotation");

    var annotation_2019 = death_annotation.append("g").attr("class", "deaht-annotation-2019").attr("opacity", 0);
    annotation_2019
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2019))
        .attr("y1", 0)
        .attr("x2", xScale(2019))
        .attr("y2", height);

    annotation_2019.append("g")
        .append("text")
        .attr("y", -15)
        .attr("x", xScale(2019))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em")
        .style('font-weight', 'bold')
        .text("2019");

    annotation_2019.transition().duration(500).attr('opacity', 1);
}

function drawTransitionDeathScene(code) {
    const dataWithForecast = filterDataByCode(data, code);
    const nonForecastData = dataWithForecast.filter(d => d.isForecastYear !== true);
    const forecastData = dataWithForecast.filter(d => d.isForecastYear === true);
    var baseTransformedGroup = svg.select(".baseTransformGroup");
    var lineChartGroup = baseTransformedGroup.select("g .death-line-chart");

    const yMax = d3.max(dataWithForecast.map(d => d.deaths));
    const years = dataWithForecast.map(d => d.year);
    const yearMax = d3.max(years);
    const yMin = 40000000;

    //Remove Annotation
    var death_annotation = baseTransformedGroup.select("g .death-annotation")
    death_annotation.remove();
    var lineLabel = baseTransformedGroup.select("g .line-label");
    lineLabel.remove();

    xScale = d3.scaleTime().domain(d3.extent(years)).range([0, width]);
    yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    axes = transitionAxes(dataWithForecast, xScale, yScale, "year");
    transitionDottedLine(lineChartGroup, forecastData, xScale, yScale, "year", "deaths",
        deaths_line_color, line_width, forecast_line_width, line_dasharray, line_dot_radius, forecast_line_dasharray);

    reset_header("Number of deaths per year", "World");
    add_sub_header();
    //Label
    transition_death_label(dataWithForecast);

    //Annotation
    transition_death_annotation();
}

function transition_death_label(dataWithForecast) {
    const years = dataWithForecast.map(d => d.year);
    const yearMax = d3.max(years);
    lineLabel = deathLine.lineGroup.append("text").attr("class", "line-label").attr("opacity", 0);
    var death_yearmax = dataWithForecast.find(d => d.year === yearMax).deaths;

    lineLabel
        .attr("x", xScale(yearMax + 1))
        .attr("y", yScale(death_yearmax) + 10)
        .style("fill", deaths_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Deaths")
    /*  .append('tspan')
      .attr("x", xScale(yearMax+1))
      .attr("y", yScale(death_yearmax) +30)
      .text("Deaths per year");*/
    lineLabel.transition().duration(500).attr('opacity', 1);
}

function transition_death_annotation() {
    var lineChart = baseTransformedGroup.select("g .death-line-chart")
    var death_annotation = lineChart.append("g").attr("class", "death-annotation");

    var annotation_2019 = death_annotation.append("g").attr("class", "death-annotation-2019").attr("opacity", 0);
    annotation_2019
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2019))
        .attr("y1", 0)
        .attr("x2", xScale(2019))
        .attr("y2", height);

    annotation_2019.append("g")
        .append("text")
        .attr("y", -20)
        .attr("x", xScale(2019))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em")
        .style('font-weight', 'bold')
        .text("2019");

    annotation_2019.transition().duration(500).attr('opacity', 1);

    //2nd annotation
    var death_2099_annotation = death_annotation.append("g").attr("class", "death-2099").attr("opacity", 0);
    death_2099_annotation
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2099))
        .attr("y1", 0)
        .attr("x2", xScale(2099))
        .attr("y2", height);

    var death_2099_annotation_text = death_2099_annotation.append("g")
        .append("text")
        .attr("y", -40)
        .attr("x", xScale(2099))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em");
    death_2099_annotation_text.append('tspan')
        .style('font-weight', 'bold')
        .text("2099: ")
    death_2099_annotation_text
        .append('tspan')
        .text("Projected to increase. ")
        .append('tspan')
        .attr("y", -10)
        .attr("x", xScale(2099))
        .text("Approx 121 million deaths/year.");
    death_2099_annotation.transition().duration(500).attr('opacity', 1);
}

function transitionOutDeathScene(transitionDuration, afterTransition) {
    var baseTransformedGroup = svg.select(".baseTransformGroup");
    baseTransformedGroup.select("g .death-line-chart")
        .transition()
        .duration(transitionDuration)
        .remove()
        .on("end", afterTransition);
}

function drawBirthAndDeathScene(code) {
    drawBirthAndDeathChart(code);
    //Annotation
    birth_death_annotation();
}


function drawBirthAndDeathChart(code) {
    const dataWithForecast = filterDataByCode(data, code);
    const nonForecastData = dataWithForecast.filter(d => d.isForecastYear !== true);
    const forecastData = dataWithForecast.filter(d => d.isForecastYear === true);
    var baseTransformedGroup = svg.select(".baseTransformGroup");

    const birthMax = d3.max(dataWithForecast.map(d => d.births));
    const deathMax = d3.max(dataWithForecast.map(d => d.deaths));
    const popMax = d3.max(dataWithForecast.map(d => d.population_growth));
    const yMax = d3.max([birthMax, deathMax, popMax]);
    const years = dataWithForecast.map(d => d.year);
    const yearMax = d3.max(years);

    const birthMin = d3.min(dataWithForecast.map(d => d.births));
    const deathMin = d3.min(dataWithForecast.map(d => d.deaths));
    const popMin = d3.min(dataWithForecast.map(d => d.population_growth));
    const yMin = d3.min([birthMin, deathMin, popMin]);

    const yScaleMin = yMin > 0 ? 0 : yMin;
    xScale = d3.scaleTime().domain(d3.extent(years)).range([0, width]);
    yScale = d3.scaleLinear().domain([yScaleMin, yMax]).range([height, 0]);

    baseTransformedGroup.select("g .birth-death-line-chart").remove();
    var lineChartGroup = baseTransformedGroup.append("g").attr("class", "birth-death-line-chart");

    axes = drawAxes(lineChartGroup, dataWithForecast, xScale, yScale, "Year", "year");
    nonForecastDeathLine = drawDottedLine(lineChartGroup, nonForecastData, xScale, yScale,
        "year", "deaths", deaths_line_color, line_width, line_dasharray, line_dot_radius, 1);
    nonFrecastBirthLine = drawDottedLine(lineChartGroup, nonForecastData, xScale, yScale,
        "year", "births", births_line_color, line_width, line_dasharray, line_dot_radius, 1);
    nonforecastPopLine = drawDottedLine(lineChartGroup, nonForecastData, xScale, yScale,
        "year", "population_growth", population_growth_line_color, line_width, line_dasharray, line_dot_radius, 0);
    forecastDeathLine = drawLine(lineChartGroup, forecastData, xScale, yScale,
        "year", "deaths", deaths_line_color, line_width, forecast_line_dasharray, 1);
    forecastBirthLine = drawLine(lineChartGroup, forecastData, xScale, yScale,
        "year", "births", births_line_color, line_width, forecast_line_dasharray, 1);
    forecastPopLine = drawLine(lineChartGroup, forecastData, xScale, yScale,
        "year", "population_growth", population_growth_line_color, line_width, forecast_line_dasharray, 0);

    //chart header
    var entity = countries.find(c => c.code === code).entity;
    reset_header("Number of births and deaths per year", entity);
    add_sub_header();

    //Label
    var death_yearmax = forecastData.find(d => d.year === yearMax).deaths;
    var birth_yearmax = forecastData.find(d => d.year === yearMax).births;

    death_y = death_yearmax > birth_yearmax ? yScale(death_yearmax) : yScale(death_yearmax) + 10;
    birth_y = death_yearmax > birth_yearmax ? yScale(birth_yearmax) + 10 : yScale(birth_yearmax);

    var deathLineLabel = lineChartGroup.append("text").attr("class", "death-line-label").attr("opacity", 0);

    deathLineLabel
        .attr("x", xScale(yearMax + 1))
        .attr("y", death_y)
        .style("fill", deaths_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Deaths");
    deathLineLabel.transition().duration(500).attr('opacity', 1);

    var birthLineLabel = lineChartGroup.append("text").attr("class", "birth-line-label").attr("opacity", 0);
    var birth_yearmax = forecastData.find(d => d.year === yearMax).births;
    birthLineLabel
        .attr("x", xScale(yearMax + 1))
        .attr("y", birth_y)
        .style("fill", births_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Births");
    birthLineLabel.transition().duration(500).attr('opacity', 1);

    popLineLabel = lineChartGroup.append("text").attr("class", "pop-line-label").attr("opacity", 0);
    var pop_yearmax = dataWithForecast.find(d => d.year === yearMax).population_growth;
    popLineLabel
        .attr("x", xScale(yearMax + 2))
        .attr("y", yScale(pop_yearmax) + 10)
        .style("fill", population_growth_line_color)
        .style('font-weight', '500')
        .style("font-size", "0.8em")
        .text("Population")
        .append('tspan')
        .attr("y", yScale(pop_yearmax) + 25)
        .attr("x", xScale(yearMax + 5))
        .text("Growth");
}

function showEndPopMsgs() {
    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent2.text(storyMessages["st-2"])
                //  .style("display", "block")
                .style("font-style", "italic")
                .style("font-weight", "bold")
                .style("display", "block !important")
                .style("opacity", "1");
        });
}

function showEndPopMsg1() {
    const headerContent = d3.selectAll("#header-content");
    headerContent
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            headerContent.text(storyHeaders["story-summary"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent1 = d3.selectAll("#msg-content-1");
    msgContent1
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent1.text(storyMessages["st-1"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0");
}

function birth_death_annotation() {
    var lineChart = baseTransformedGroup.select("g .birth-death-line-chart")
    var annotation = lineChart.append("g").attr("class", "annotation");

    var annotation_2099 = annotation.append("g").attr("class", "annotation-2099").attr("opacity", 0);
    annotation_2099
        .attr("width", width)
        .attr("height", height)
        .append("line")
        .style("stroke", "#959595")
        .style("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("x1", xScale(2099))
        .attr("y1", 0)
        .attr("x2", xScale(2099))
        .attr("y2", height);

    var annotation_2099_text = annotation_2099.append("g")
        .append("text")
        .attr("y", -40)
        .attr("x", xScale(2099))
        .style("text-anchor", "end")
        .attr("dy", "1em")
        .style("fill", "#959595")
        .style("font-size", "0.75em");
    annotation_2099_text.append('tspan')
        .style('font-weight', 'bold')
        .text("2099: ")
    annotation_2099_text
        .append('tspan')
        .text("Projected Births: 125 Million. ")
        .append('tspan')
        .attr("y", -10)
        .attr("x", xScale(2099))
        .text("Projected Deaths: 121 Million. ")
    annotation_2099.transition().duration(500).attr('opacity', 1);
}

function drawPopulationEndLine(code) {

    var lineChartGroup = baseTransformedGroup.select("g .birth-death-line-chart");

    lineChartGroup.selectAll("g .line-path-group")
        .transition().duration(500).attr("opacity", 1);
    lineChartGroup.selectAll("g .dot-group")
        .transition().duration(500).attr("opacity", 1);
    lineChartGroup.selectAll("g .pop-line-label")
        .transition().duration(500).attr("opacity", 1);
}

function explorerScene(code) {
    drawBirthAndDeathChart(code);
    drawPopulationEndLine(code);
    var entity = countries.find(c => c.code === code).entity;
    reset_header("Population Growth, number of births and deaths per year", entity);
    add_sub_header();
    explorerSceneToolTip(code);
}

function showExplorerMsgs() {
    const headerContent = d3.selectAll("#header-content");
    headerContent
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            headerContent.text(storyHeaders["explore"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent1 = d3.selectAll("#msg-content-1");
    msgContent1
        .text("")
        .style("display", "block")
        .style("opacity", "0")
        .transition().duration(500)
        .on("end", () => {
            msgContent1.text(storyMessages["explore"])
                .style("display", "block")
                .style("opacity", "1");
        });

    const msgContent2 = d3.selectAll("#msg-content-2");
    msgContent2
        .text("")
        .style("display", "block")
        .style("opacity", "0");
}

function explorerSceneToolTip(code) {

    currentCode = code;
    dataWithForecast = filterDataByCode(data, currentCode);
    var lineChartGroup = baseTransformedGroup.select("g .birth-death-line-chart")
    toolTipLine = lineChartGroup.append("line").attr("class", "tooltip-line");
    toolTipDeathCircle = lineChartGroup.append("circle").attr("class", "tooltip-deaths-circle");
    toolTipBirthCircle = lineChartGroup.append("circle").attr("class", "tooltip-births-circle");
    toolTipPopCircle = lineChartGroup.append("circle").attr("class", "tooltip-pop-circle");
    toolTipRect = lineChartGroup.append("rect").attr("class", "tooltip-rect")
        .attr("class", "rect-tooltip")
        .attr("width", width)
        .attr("height", height)
        .attr("opacity", 0)
        .on("mousemove", mouseOverTooltipAction)
        .on("mouseout", mouseOutFromTooltipAction);
}

function mouseOverTooltipAction() {

    toolTipRect = d3.select(this);
    const nodeData = d3.mouse(toolTipRect.node())[0];
    const hoverYear = xScale.invert(nodeData);
    var bisect = d3.bisector(d => d.year).left;
    var i = bisect(dataWithForecast, hoverYear, 1);
    var hoverData = dataWithForecast[i];
    var toolTipContentDiv = d3.selectAll("#tooltip");

    toolTipLine.attr("stroke", "rgba(180,180,180,.4)")
        .attr("x1", xScale(hoverData.year))
        .attr("x2", xScale(hoverData.year))
        .attr("y1", 0)
        .attr("y2", height);

    toolTipDeathCircle.attr("fill", deaths_line_color)
        .attr("stroke", deaths_line_color)
        .attr("cx", xScale(hoverData.year))
        .attr("cy", yScale(hoverData.deaths))
        .attr("r", tooltip_dot_radius)
        .attr("opacity", 1);
    toolTipBirthCircle.attr("fill", births_line_color)
        .attr("stroke", births_line_color)
        .attr("cx", xScale(hoverData.year))
        .attr("cy", yScale(hoverData.births))
        .attr("r", tooltip_dot_radius)
        .attr("opacity", 1);
    toolTipPopCircle.attr("fill", population_growth_line_color)
        .attr("stroke", population_growth_line_color)
        .attr("cx", xScale(hoverData.year))
        .attr("cy", yScale(hoverData.population_growth))
        .attr("r", tooltip_dot_radius)
        .attr("opacity", 1);
    if (hoverYear < dataWithForecast[dataWithForecast.length - 1].year && hoverYear > dataWithForecast[0].year) {
        toolTipContentDiv.style("opacity", 1)
            .style("display", "block")
            .style("left", (d3.event.pageX) + 10 + "px")
            .style("top", yScale(0) - margin.top + "px")
            .style("background-color", tooltip_background_color)
            .html(toolTipContent(hoverData));
    } else {
        removeTooltip(toolTipContentDiv, toolTipLine);
    }
}

function toolTipContent(hoverData) {
    return `<table style="font-size: 0.9em; line-height: 1.4em; white-space: normal;>
        <tbody>
            <tr>
                <td colspan="3"><strong>${hoverData.entity}-${hoverData.year}</strong></td>
            </tr>
            <tr style="color: black;">
                <td>
                    <div style="width: 10px; height: 10px; border-radius: 5px; background-color: ${births_line_color}; display: inline-block; margin-right: 2px;"></div>
                </td>
                <td style="padding-right: 0.8em; font-size: 0.9em;">${hoverData.isForecastYear ? "Projected Births" : "Births"}</td>
                <td style="text-align: right; white-space: nowrap;">${formatTicks(hoverData.births)}</td>
            </tr>
            <tr style="color: black;">
                <td>
                    <div style="width: 10px; height: 10px; border-radius: 5px; background-color: ${deaths_line_color}; display: inline-block; margin-right: 2px;"></div>
                </td>
                <td style="padding-right: 0.8em; font-size: 0.9em;">${hoverData.isForecastYear ? "Projected Deaths" : "Deaths"}</td>
                <td style="text-align: right; white-space: nowrap;">${formatTicks(hoverData.deaths)}</td>
            </tr>
            <tr style="color: black;">
                <td>
                    <div style="width: 10px; height: 10px; border-radius: 5px; background-color: ${population_growth_line_color}; display: inline-block; margin-right: 2px;"></div>
                </td>
                <td style="padding-right: 0.8em; font-size: 0.9em;">${hoverData.isForecastYear ? "Projected Population Growth" : "Population Growth"}</td>
                <td style="text-align: right; white-space: nowrap;">${formatTicks(hoverData.population_growth)}</td>
            </tr>
        </table>`;
}

function removeTooltip(toolTipContentDiv, toolTipLine) {
    if (toolTipContentDiv) toolTipContentDiv.style('display', 'none');
    if (toolTipLine) toolTipLine.attr('stroke', 'none');
}

function mouseOutFromTooltipAction() {
    var toolTipContentDiv = d3.selectAll("#tooltip")
    if (toolTipContentDiv) toolTipContentDiv.style("display", "none");
    if (toolTipLine) toolTipLine.attr("stroke", "none");
    if (toolTipDeathCircle) toolTipDeathCircle.attr("opacity", 0);
    if (toolTipBirthCircle) toolTipBirthCircle.attr("opacity", 0);
    if (toolTipPopCircle) toolTipPopCircle.attr("opacity", 0);
}

function transitionOutBirthAndDeathScene(transitionDuration, afterTransition) {
    var baseTransformedGroup = svg.select(".baseTransformGroup");
    baseTransformedGroup.select("g .birth-death-line-chart")
        .transition()
        .duration(transitionDuration)
        .remove()
        .on("end", afterTransition);
}

function drawExplorerScene(code) {
    explorerScene(default_filter_code);
    d3.select(".change-countries").style("opacity", 1);
    d3.select(".change-country-button").style("opacity", 1);

    d3.select(".change-country-button")
        .on('click', () => {
            d3.select(".change-country-button")
                .style("opacity", 0);
        });

    d3.select(".countries-select")
        .property('disabled', false)
        .on('change', () => {
            d3.select(".change-country-button")
                .style("opacity", 1);
            selectValue = d3.select('select').property('value');
            console.log(d3.select('select').property('value'))
            explorerScene(selectValue);
        });
}

function setupFooter() {
   
    footerCont = d3.select("#footer")
    .append("span")
    .attr("class", "footer-cont")
    .text(footerContContent + " | ");

    d3.select("#footer")
    .append("span")
    .attr("class", "clickable")
    .text(footerReplayContent)
    .on('click', function () {
        location.reload();
    });

    d3.select("#footer")
    .append("span")
    .text(" | ");

    d3.select("#footer")
    .append("a")
    .attr("href", dsrLink)
    .text(footerDsr)
    .style("color", "#959595;");
}

function addSpaceBarListner(onPressAction) {
    document.addEventListener("keyup", event => {
        if (event.code === "Space") {
            onPressAction();
        }
    });
}

//SpaceBar Pressed Action
function SpaceBarPressedAction() {
    spaceBarPressCount = spaceBarPressCount + 1;
    if (spaceBarPressCount === 1) {
        hideStoryLine(() => {
            showPopMsg();
            DrawPopulationScene(default_filter_code);
        })
    }

    if (spaceBarPressCount === 2) {
        transitionOutPopulationScene(500, () => {
            showBirthMsg1();
            drawBirthScene(default_filter_code);
        });
    }

    if (spaceBarPressCount === 3) {
        showBirthMsgs();
        drawTransitionBirthScene(default_filter_code);
    }

    if (spaceBarPressCount === 4) {
        transitionOutBirthScene(500, () => {
            showDeathMsg1();
            drawDeathScene(default_filter_code);
        });
    }

    if (spaceBarPressCount === 5) {
        showDeathMsgs();
        drawTransitionDeathScene(default_filter_code);
    }


    if (spaceBarPressCount === 6) {
        transitionOutDeathScene(500, () => {
            showEndPopMsg1();
            drawBirthAndDeathScene(default_filter_code);
        });
    }

    if (spaceBarPressCount === 7) {
        showEndPopMsgs();
        drawPopulationEndLine(default_filter_code);
        reset_header("Population Growth, number of births and deaths per year", "World");
        add_sub_header();
    }

    if (spaceBarPressCount === 8) {
        transitionOutBirthAndDeathScene(500, () => {
            showExplorerMsgs();
            drawExplorerScene(default_filter_code);

            footerCont.transition().remove();
        });
    }

    transitionSceneMessages();
}


//init
async function init() {
    const populationGrowthData = await d3.csv("data/population-growth-the-annual-change-of-the-population.csv", formatPopulationGrowthData);
    data = await d3.csv("data/births-and-deaths-projected-to-2100.csv", (d) => formatAndCombineData(d, populationGrowthData));
    svg = initialSetup();
    baseTransformedGroup = svg.append("g").attr("class", baseTransformGroupName)
        .attr("transform", "translate(" + margin.left * 1.25 + ", " + margin.top + ")");
    addSpaceBarListner(SpaceBarPressedAction);
    populateCountriesFilter();
    startStory();
}