function abbrState(input, to) {

    var states = [
        ['Arizona', 'AZ'],
        ['Alabama', 'AL'],
        ['Alaska', 'AK'],
        ['Arkansas', 'AR'],
        ['California', 'CA'],
        ['Colorado', 'CO'],
        ['Connecticut', 'CT'],
        ['Delaware', 'DE'],
        ['District Of Columbia', 'DC'],
        ['Florida', 'FL'],
        ['Georgia', 'GA'],
        ['Hawaii', 'HI'],
        ['Idaho', 'ID'],
        ['Illinois', 'IL'],
        ['Indiana', 'IN'],
        ['Iowa', 'IA'],
        ['Kansas', 'KS'],
        ['Kentucky', 'KY'],
        ['Louisiana', 'LA'],
        ['Maine', 'ME'],
        ['Maryland', 'MD'],
        ['Massachusetts', 'MA'],
        ['Michigan', 'MI'],
        ['Minnesota', 'MN'],
        ['Mississippi', 'MS'],
        ['Missouri', 'MO'],
        ['Montana', 'MT'],
        ['Nebraska', 'NE'],
        ['Nevada', 'NV'],
        ['New Hampshire', 'NH'],
        ['New Jersey', 'NJ'],
        ['New Mexico', 'NM'],
        ['New York', 'NY'],
        ['North Carolina', 'NC'],
        ['North Dakota', 'ND'],
        ['Ohio', 'OH'],
        ['Oklahoma', 'OK'],
        ['Oregon', 'OR'],
        ['Pennsylvania', 'PA'],
        ['Rhode Island', 'RI'],
        ['South Carolina', 'SC'],
        ['South Dakota', 'SD'],
        ['Tennessee', 'TN'],
        ['Texas', 'TX'],
        ['Utah', 'UT'],
        ['Vermont', 'VT'],
        ['Virginia', 'VA'],
        ['Washington', 'WA'],
        ['West Virginia', 'WV'],
        ['Wisconsin', 'WI'],
        ['Wyoming', 'WY'],
    ];

    if (to == 'abbr') {
        input = input.replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        for (i = 0; i < states.length; i++) {
            if (states[i][0] == input) {
                return (states[i][1]);
            }
        }
    } else if (to == 'name') {
        input = input.toUpperCase();
        for (i = 0; i < states.length; i++) {
            if (states[i][1] == input) {
                return (states[i][0]);
            }
        }
    }
}

const start_id_base = 11;
const start_id_base_pred = 1;
const start_id_add = 39;

const start_id = start_id_base + start_id_add;
const start_id_pred = start_id_base_pred + start_id_add;

var deltaLag = document.getElementById('deltaLagDays');

$.ajax({
    url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv',
    success: function (csv) {
        csv = $.csv.toArrays(csv);
        console.log(csv);

        var states = {},
            counties = {},
            mapChart,
            countyChart,
            stateChart,
            numRegex = /^[0-9\.]+$/,
            lastCommaRegex = /,\s$/,
            quoteRegex = /\"/g,
            categories = csv[0];

        function updateCounties() {
            url = 'https://raw.githubusercontent.com/excitedFrog/excitedFrog.github.io/master/PandEconDChart/data/pred_case' + parseInt(deltaLag.value).toString() + '.csv';
            $.ajax({
                url: url,
                success: function (csv_county) {
                    csv_county = $.csv.toArrays(csv_county);
                    var categories = csv_county[0];
                    $.each(csv_county.slice(1), function (j, row) {
                        var fips = ("00000" + parseInt(row[0])).substr(-5, 5),
                            data = [],
                            data2 = [];
                        $.each(row.slice(1), function (i, value) {
                            data.push(parseInt(value));
                            data2.push([categories[start_id_pred + i], parseInt(value)]);
                            });
                        counties[fips] = {
                            name: counties[fips].name,
                            fips: counties[fips].fips,
                            abbr: counties[fips].abbr,
                            data: counties[fips].data,
                            data2: counties[fips].data2,
                            dataP: data,
                            dataP2: data2,
                        }
                    });
                }
            })
        }

        function updateChart() {
            while (countyChart.get('projection')) {
                countyChart.get('projection').remove();
            }
            var points = mapChart.getSelectedPoints();
            points.forEach(function (p) {
                countyChart.addSeries({
                    id: 'projection',
                    name: p.name + ' (Projected)',
                    data: counties[p.fips].dataP2,
                    type: 'line',
                    dashStyle: 'ShortDot'
                }, false);
            });
            countyChart.redraw();
            stateChart.redraw();
        }

        // Parse the CSV into arrays, one array each County
        $.each(csv.slice(1), function (j, row) {
            var c_name = row[10],
                c_fips = row[4],
                c_data = [],
                c_data2 = [],
                s_name = row[6],
                s_abbr = abbrState(s_name, 'abbr'),
                s_data = [],
                s_data2 = [];

            if (s_abbr) {
                s_abbr = s_abbr.toLowerCase();
                $.each(row.slice(start_id), function (i, val) {
                    val = val.replace(quoteRegex, '');
                    if (numRegex.test(val)) {
                        val = parseInt(val, 10);
                    } else if (!val || lastCommaRegex.test(val)) {
                        val = null;
                    }
                    c_data.push(val);
                    c_data2.push([categories[start_id + i], val]);
                });

                counties[("00000" + parseInt(row[4])).substr(-5, 5)] = {
                    name: c_name,
                    fips: c_fips,
                    data: c_data,
                    data2: c_data2,
                    abbr: s_abbr
                };

                if (states.hasOwnProperty(s_abbr)) {
                    var s_data_ = [],
                        s_data2_ = [];
                    for (var i = 0; i < c_data.length; i++) {
                        s_data_.push(c_data[i] + states[s_abbr].data[i]);
                        s_data2_.push([categories[start_id + i], c_data[i] + states[s_abbr].data[i]])
                    }
                    s_data = s_data_;
                    s_data2 = s_data2_;
                } else {
                    s_data = c_data;
                    s_data2 = c_data2;
                }
                states[s_abbr] = {
                    name: s_name,
                    abbr: s_abbr,
                    data: s_data,
                    data2: s_data2,
                }
            }
        });

        updateCounties();

        // For each county, use the latest value for current population
        var data = [];
        for (var fips in counties) {
            if (counties.hasOwnProperty(fips)) {
                var value = null,
                    date_last,
                    itemData = counties[fips].data,
                    i = itemData.length,
                    abbr = counties[fips].abbr

                while (i--) {
                    if (typeof itemData[i] === 'number') {
                        value = itemData[i];
                        date_last = categories[i];
                        break;
                    }
                }
                data.push({
                    name: counties[fips].name,
                    fips: fips,
                    value: value,
                    date_last: date_last,
                    abbr: abbr,
                    state_name: abbrState(abbr.toUpperCase(), 'name')
                });
            }
        }

        // Add lower case codes to the data set for inclusion in the tooltip.pointFormat
        var mapData = Highcharts.geojson(
            Highcharts.maps['countries/us/us-all-all']
            ),
            // Extract the line paths from the GeoJSON
            lines = Highcharts.geojson(
                Highcharts.maps['countries/us/us-all-all'], 'mapline'
            ),
            // Filter out the state borders and separator lines, we want these
            // in separate series
            borderLines = Highcharts.grep(lines, function (l) {
                return l.properties['hc-group'] === '__border_lines__';
            }),
            separatorLines = Highcharts.grep(lines, function (l) {
                return l.properties['hc-group'] === '__separator_lines__';
            });

        $.each(mapData, function () {
            this.id = this.properties['fips']; // for Chart.get()
            // this.flag = this.id;
            this.name = this.name + ', ' + this.properties['hc-key'].substr(3, 2).toUpperCase();
            this.abbr = this.properties['hc-key'].substr(3, 2);
        });

        // Wrap point.select to get to the total selected points
        Highcharts.wrap(Highcharts.Point.prototype, 'select', function (proceed) {

            proceed.apply(this, Array.prototype.slice.call(arguments, 1));

            var points = mapChart.getSelectedPoints();
            if (points.length) {
                if (points.length === 1) {
                    $('#info h2').html(points[0].name.split(',')[0] + ' County,' + points[0].name.split(',')[1]);
                    $('#info2 h2').html(points[0].state_name + ' State');
                } else {
                    $('#info h2').html('Comparing counties');
                    $('#info2 h2').html('Comparing state-level');
                }
                $('#info .subheader').html('<h4>Number of Infected Number over time</h4><small><em>Shift + Click on map to compare counties</em></small>');
                $('#info2 .subheader').html('<h4>Number of Infected Number over time</h4>');

                if (!countyChart) {
                    countyChart = Highcharts.chart('county-chart', {
                        chart: {
                            height: 250,
                            spacingLeft: 0
                        },
                        credits: {
                            enabled: false
                        },
                        title: {
                            text: null
                        },
                        subtitle: {
                            text: null
                        },
                        xAxis: {
                            type: 'category',
                            tickPixelInterval: 50,
                            crosshair: true
                        },
                        yAxis: {
                            title: null,
                            opposite: true
                        },
                        tooltip: {
                            split: true
                        },
                        plotOptions: {
                            series: {
                                animation: {
                                    duration: 1000
                                },
                                marker: {
                                    enabled: false
                                },
                                threshold: 0,
                            }
                        }
                    });
                }

                if (!stateChart) {
                    stateChart = Highcharts.chart('state-chart', {
                        chart: {
                            height: 250,
                            spacingLeft: 0
                        },
                        credits: {
                            enabled: false
                        },
                        title: {
                            text: null
                        },
                        subtitle: {
                            text: null
                        },
                        xAxis: {
                            type: 'category',
                            tickPixelInterval: 50,
                            crosshair: true
                        },
                        yAxis: {
                            title: null,
                            opposite: true
                        },
                        tooltip: {
                            split: true
                        },
                        plotOptions: {
                            series: {
                                animation: {
                                    duration: 1000
                                },
                                marker: {
                                    enabled: false
                                },
                                threshold: 0,
                                pointStart: parseInt(categories[start_id], 10)
                            }
                        },
                    });
                }


                countyChart.series.slice(0).forEach(function (s) {
                    s.remove(false);
                });
                stateChart.series.slice(0).forEach(function (s) {
                    s.remove(false);
                });

                points.forEach(function (p) {
                    countyChart.addSeries({
                        id: 'realized',
                        name: p.name,
                        data: counties[p.fips].data2,
                        type: points.length > 1 ? 'line' : 'area'
                    }, false);
                    countyChart.addSeries({
                        id: 'projection',
                        name: p.name,
                        data: counties[p.fips].dataP2,
                        type: 'line',
                        dashStyle: 'ShortDot'
                    }, false);
                    stateChart.addSeries({
                        id: 'realized',
                        name: p.state_name,
                        data: states[p.abbr].data2,
                        type: points.length > 1 ? 'line' : 'area'
                    }, false);
                });
                countyChart.redraw();
                stateChart.redraw();

            } else {
                $('#info #flag').attr('class', '');
                $('#info h2').html('');
                $('#info .subheader').html('');
                $('#info2 #flag').attr('class', '');
                $('#info2 h2').html('');
                $('#info2 .subheader').html('');
                if (countyChart) {
                    countyChart = countyChart.destroy();
                }
                if (stateChart) {
                    stateChart = stateChart.destroy();
                }
            }
        });

        // Initiate the map chart
        mapChart = Highcharts.mapChart('container', {

            title: {
                text: 'U.S. COVID-19 Infected Number Map'
            },

            subtitle: {
                text: 'Source: <a href="https://github.com/CSSEGISandData/COVID-19">CSSEGISandData</a>'
            },

            mapNavigation: {
                enabled: true,
                buttonOptions: {
                    verticalAlign: 'bottom'
                }
            },

            colorAxis: {
                type: 'linear',
                endOnTick: false,
                startOnTick: false,
                tickInterval: 100,
                min: 0,
                max: 1000,
                minColor: '#ffffff',
                maxColor: '#000000',
            },

            legend: {
                layout: 'vertical',
                align: 'right',
                floating: true,
                backgroundColor: ( // theme
                    Highcharts.defaultOptions &&
                    Highcharts.defaultOptions.legend &&
                    Highcharts.defaultOptions.legend.backgroundColor
                ) || 'rgba(255, 255, 255, 0.85)'
            },


            tooltip: {
                footerFormat: '<span style="font-size: 10px">(Click for details)</span>'
            },

            series: [
                {
                    data: data,
                    mapData: mapData,
                    joinBy: ['fips', 'fips'],
                    name: 'Current Case Number',
                    allowPointSelect: true,
                    borderWidth: 0.5,
                    states: {
                        hover: {
                            color: '#ff4d4d'
                        },
                        select: {
                            color: '#b30000',
                        }
                    },
                    shadow: false
                },
                {
                    type: 'mapline',
                    name: 'State borders',
                    data: borderLines,
                    color: 'black',
                    shadow: false
                },
                {
                    type: 'mapline',
                    name: 'Separator',
                    data: separatorLines,
                    color: 'black',
                    shadow: false
                }
            ]
        });

        // Pre-select NYC
        mapChart.get('36061').select();

        // jQuery Listen to change of parameters
        $('#deltaLagDays').change(function () {
            updateCounties();
            updateChart();
        })
    }
});
