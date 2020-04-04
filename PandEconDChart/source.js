$.ajax({
    url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv',
    success: function (csv) {
        csv = $.csv.toArrays(csv);

        var counties = {},
            mapChart,
            countyChart,
            numRegex = /^[0-9\.]+$/,
            lastCommaRegex = /,\s$/,
            quoteRegex = /\"/g,
            categories = csv.slice(0, 1)[0];

        // Parse the CSV into arrays, one array each County
        $.each(csv.slice(1), function (j, row) {
            var data = row.slice(11),
                data2 = row.slice(11);
            $.each(data, function (i, val) {
                val = val.replace(quoteRegex, '');
                if (numRegex.test(val)) {
                    val = parseInt(val, 10);
                } else if (!val || lastCommaRegex.test(val)) {
                    val = null;
                }
                data[i] = val;
                data2[i] = [categories[11+i], val]
            });

            counties[("00000" + row[4]).substr(-5, 5)] = {
                name: row[10],
                fips: row[4],
                data: data,
                data2: data2
            };
        });

        // For each country, use the latest value for current population
        var data = [];
        for (var fips in counties) {
            if (counties.hasOwnProperty(fips)) {
                var value = null,
                    date_last,
                    itemData = counties[fips].data,
                    i = itemData.length;

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
                    date_last: date_last
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
            this.flag = this.id;
            this.name = this.name + ', ' + this.properties['hc-key'].substr(3, 2).toUpperCase();
        });

        // Wrap point.select to get to the total selected points
        Highcharts.wrap(Highcharts.Point.prototype, 'select', function (proceed) {

            proceed.apply(this, Array.prototype.slice.call(arguments, 1));

            var points = mapChart.getSelectedPoints();
            if (points.length) {
                if (points.length === 1) {
                    $('#info #flag').attr('class', 'flag ' + points[0].flag);
                    $('#info h2').html(points[0].name);
                } else {
                    $('#info #flag').attr('class', 'flag');
                    $('#info h2').html('Comparing countries');

                }
                $('#info .subheader').html('<h4>Number of Confirmed Case over time</h4><small><em>Shift + Click on map to compare countries</em></small>');

                if (!countyChart) {
                    countyChart = Highcharts.chart('country-chart', {
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
                                pointStart: parseInt(categories[11], 10)
                            }
                        }
                    });
                }

                countyChart.series.slice(0).forEach(function (s) {
                    s.remove(false);
                });
                points.forEach(function (p) {
                    countyChart.addSeries({
                        name: p.name,
                        data: counties[p.fips].data2,
                        type: points.length > 1 ? 'line' : 'area'
                    }, false);
                });
                countyChart.redraw();

            } else {
                $('#info #flag').attr('class', '');
                $('#info h2').html('');
                $('#info .subheader').html('');
                if (countyChart) {
                    countyChart = countyChart.destroy();
                }
            }
        });

        // Initiate the map chart
        mapChart = Highcharts.mapChart('container', {

            title: {
                text: 'U.S. COVID-19 Confirmed Case Number Map'
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

            series: [{
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
                    name: 'Separator',
                    data: separatorLines,
                    color: '#333333',
                    shadow: false
                }
            ]
        });

        // Pre-select Cook County
        mapChart.get('36061').select();
    }
});
