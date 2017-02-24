
(function($){


    $(window).ready(setupPieChart);


    function setupPieChart() {


        var dimensions = knuthfisheryates2(['walking', 'programming', 'chess', 'eating', 'sleeping']);
        var randomProportions = generateRandomProportions(dimensions.length, 0.05);
        var proportions = dimensions.map(function(d,i) { return {
            label: d,
            proportion: randomProportions[i],
            collapsed: false,
            format: {
                label: d.charAt(0).toUpperCase() + d.slice(1) // capitalise first letter
            }
        }});


        var setup = {
            canvas: document.getElementById('piechart'),
            radius: 0.9,
            collapsing: true,
            proportions: proportions,
            drawSegment: drawSegmentOutlineOnly,
            onchange: onPieChartChange
        };

        var newPie = new DraggablePiechart(setup);

        function drawSegmentOutlineOnly(context, piechart, centerX, centerY, radius, startingAngle, arcSize, format, collapsed) {

            if (collapsed) { return; }

            // Draw segment
            context.save();
            var endingAngle = startingAngle + arcSize;
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.arc(centerX, centerY, radius, startingAngle, endingAngle, false);
            context.closePath();

            context.fillStyle = '#f5f5f5';
            context.fill();
            context.stroke();
            context.restore();

            // Draw label on top
            context.save();
            context.translate(centerX, centerY);
            context.rotate(startingAngle);

            var fontSize = Math.floor(context.canvas.height / 25);
            var dx = radius - fontSize;
            var dy = centerY / 10;

            context.textAlign = "right";
            context.font = fontSize + "pt Helvetica";
            context.fillText(format.label, dx, dy);
            context.restore();
        }

        function onPieChartChange(piechart) {

            var table = $('#proportions-table');
            var percentages = piechart.getAllSliceSizePercentages();

            var labelsRow = $('<tr/>').append(proportions.map(function(v,i) { return '<th>' + v.format.label + '</th>' }));
            var proportionsRow = $('<tr/>').append(proportions.map(function(v,i) {

                var plus = $('<div/>').attr('id', 'plus-' + dimensions[i]).addClass('adjust-button').data({i: i, d: -1}).html('&#43;').mousedown(adjustClick);
                var minus = $('<div/>').attr('id', 'plus-' + dimensions[i]).addClass('adjust-button').data({i: i, d: 1}).html('&#8722;').mousedown(adjustClick);

                return $('<td/>').append('<var>' + percentages[i].toFixed(0) + '%</var>').append(plus).append(minus);

            }));

            table.html('').append(proportionsRow).append(labelsRow);
            function adjustClick() {
                var i = $(this).data('i');
                var d = $(this).data('d');

                piechart.moveAngle(i, (d * 0.1));
            }

        }

        /*
         * Generates n proportions with a minimum percentage gap between them
         */
        function generateRandomProportions(n, min) {

            // n random numbers 0 - 1
            var rnd = Array.apply(null, {length: n}).map(function(){ return Math.random(); });

            // sum of numbers
            var rndTotal = rnd.reduce(function(a, v) { return a + v; }, 0);

            // get proportions, then make sure each propoertion is above min
            return validateAndCorrectProportions(rnd.map(function(v) { return v / rndTotal; }), min);


            function validateAndCorrectProportions(proportions, min) {
                var sortedProportions = proportions.sort(function(a,b){return a - b});

                for (var i = 0; i < sortedProportions.length; i += 1) {
                    if (sortedProportions[i] < min) {
                        var diff = min - sortedProportions[i];
                        sortedProportions[i] += diff;
                        sortedProportions[sortedProportions.length - 1] -= diff;
                        return validateAndCorrectProportions(sortedProportions, min);
                    }
                }

                return sortedProportions;
            }
        }

        /*
         * Array sorting algorithm
         */
        function knuthfisheryates2(arr) {
            var temp, j, i = arr.length;
            while (--i) {
                j = ~~(Math.random() * (i + 1));
                temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }

            return arr;
        }
    }

})(jQuery);



