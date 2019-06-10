/**
 * Created by james on 23/02/2017.
 */

(function(){

    var extend = function(out) {
        out = out || {};

        for (var i = 1; i < arguments.length; i++) {
            if (!arguments[i])
                continue;

            for (var key in arguments[i]) {
                if (arguments[i].hasOwnProperty(key))
                    out[key] = arguments[i][key];
            }
        }

        return out;
    };

    var DraggablePiechart = function(setup) {

        var piechart = this;

        setup = extend({}, this.defaults, setup);

        this.canvas = setup.canvas;
        this.context = setup.canvas.getContext("2d");

        if (!this.context) {
            console.log('Error: DraggablePiechart needs an html5 canvas.');
            return;
        }

        if (setup.proportions) {
            this.data = generateDataFromProportions(setup.proportions);
        } else if (setup.data) {
            this.data = setup.data;
        }

        this.draggedPie = null;
        this.hoveredIndex = -1;
        this.radius = setup.radius;
        this.collapsing = setup.collapsing;
        this.minAngle = setup.minAngle;
        this.drawSegment = setup.drawSegment;
        this.drawNode = setup.drawNode;
        this.onchange = setup.onchange;


        // Bind appropriate events
        if (is_touch_device()) {
            this.canvas.addEventListener('touchstart', touchStart);
            this.canvas.addEventListener('touchmove',touchMove);
            document.addEventListener('touchend', touchEnd);
        } else {
            this.canvas.addEventListener('mousedown',touchStart);
            this.canvas.addEventListener('mousemove',touchMove);
            document.addEventListener('mouseup', touchEnd);
        }

        this.draw();

        function touchStart(event) {

            piechart.draggedPie = piechart.getTarget(getMouseLocation(event));
            if (piechart.draggedPie) {
                piechart.hoveredIndex = piechart.draggedPie.index;
            }
        }

        function touchEnd() {

            if (piechart.draggedPie) {
                piechart.draggedPie = null;
                piechart.draw();
            }
        }

        function touchMove(event) {
            var dragLocation = getMouseLocation(event);

            if (!piechart.draggedPie) {
                var hoveredTarget = piechart.getTarget(dragLocation);
                if (hoveredTarget) {
                    piechart.hoveredIndex = hoveredTarget.index;
                    piechart.draw();
                } else if (piechart.hoveredIndex != -1) {
                    piechart.hoveredIndex = -1;
                    piechart.draw();
                }
                return;
            }

            var draggedPie = piechart.draggedPie;

            var dx = dragLocation.x - draggedPie.centerX;
            var dy = dragLocation.y - draggedPie.centerY;

            // Get angle of grabbed target from centre of pie
            var newAngle = Math.atan2(dy,dx) - draggedPie.angleOffset;

            piechart.shiftSelectedAngle(newAngle);
            piechart.draw();
        }
        
        function getMouseLocation(evt) {
            var rect = piechart.canvas.getBoundingClientRect();

            if (evt.clientX) {
                return {
                    x: evt.clientX - rect.left,
                    y: evt.clientY - rect.top
                }
            } else {
                return {
                    x: evt.targetTouches[0].clientX - rect.left,
                    y: evt.targetTouches[0].clientY - rect.top
                }
            }
        }

        /*
         * Generates angle data from proportions (array of objects with proportion, format
         */
        function generateDataFromProportions(proportions) {

                // sum of proportions
                var total = proportions.reduce(function(a, v) { return a + v.proportion; }, 0);

                // begin at 0
                var currentAngle = 0;

                // use the proportions to reconstruct angles
                return proportions.map(function(v, i) {
                    var arcSize = TAU * v.proportion / total;
                    var data = {
                        angle: currentAngle,
                        format: v.format,
                        collapsed: arcSize <= 0
                    };
                    currentAngle = normaliseAngle(currentAngle + arcSize);
                    return data;
                });

            }

    };

    /*
     * Move angle specified by index: i, by amount: angle in rads
     */
    DraggablePiechart.prototype.moveAngle = function(i, amount) {

        if (this.data[i].collapsed && amount < 0) {
            this.setCollapsed(i,false);
            return;
        }

        var geometry = this.getGeometry();
        this.draggedPie = {
            index: i,
            angleOffset: 0,
            centerX: geometry.centerX,
            centerY: geometry.centerY,
            startingAngles: this.data.map(function(v){ return v.angle; }),
            collapsed: this.data.map(function(v){ return v.collapsed; }),
            angleDragDistance: 0
        };

        this.shiftSelectedAngle(this.data[i].angle + amount);
        this.draggedPie = null;
        this.draw();
    };

    /*
     * Gets percentage of indexed slice
     */
    DraggablePiechart.prototype.getSliceSizePercentage = function(index) {
        var visibleSegments = this.getVisibleSegments();

        for(var i = 0; i < visibleSegments.length; i += 1) {
            if (visibleSegments[i].index == index) {
                return 100 * visibleSegments[i].arcSize / TAU;
            }
        }
        return 0;
    };

    /*
     * Gets all percentages for each slice
     */
    DraggablePiechart.prototype.getAllSliceSizePercentages = function() {
        var visibleSegments = this.getVisibleSegments();
        var percentages = [];
        for(var i = 0; i < this.data.length; i += 1) {

            if (this.data[i].collapsed) {
                percentages[i] = 0;
            } else {
                for(var j = 0; j < visibleSegments.length; j += 1) {
                    if (visibleSegments[j].index == i) {
                        percentages[i] = 100 * visibleSegments[j].arcSize / TAU;
                    }
                }
            }

        }

        return percentages;
    };

    /*
     * Gets the geometry of the pie chart in the canvas
     */
    DraggablePiechart.prototype.getGeometry = function() {
        var centerX = Math.floor(this.canvas.width / 2);
        var centerY = Math.floor(this.canvas.height / 2);
        return {
            centerX: centerX,
            centerY: centerY,
            radius: Math.min(centerX, centerY) * this.radius
        }
    };

    /*
     * Returns a segment to drag if given a close enough location
     */
    DraggablePiechart.prototype.getTarget = function(targetLocation) {

        var geometry = this.getGeometry();
        var startingAngles = [];
        var collapsed = [];

        var closest = {
            index: -1,
            distance: 9999999,
            angle: null
        };

        for (var i = 0; i < this.data.length; i += 1) {

            startingAngles.push(this.data[i].angle);
            collapsed.push(this.data[i].collapsed);

            if (this.data[i].collapsed) { continue; }


            var dx = targetLocation.x - geometry.centerX;
            var dy = targetLocation.y - geometry.centerY;
            var trueGrabbedAngle = Math.atan2(dy,dx);

            var distance = Math.abs(smallestSignedAngleBetween(trueGrabbedAngle, this.data[i].angle));

            if (distance < closest.distance) {
                closest.index = i;
                closest.distance = distance;
                closest.angle = trueGrabbedAngle;
            }
        }

        if (closest.distance < 0.1) {

            return {
                index: closest.index,
                angleOffset: smallestSignedAngleBetween(closest.angle, startingAngles[closest.index]),
                centerX: geometry.centerX,
                centerY: geometry.centerY,
                startingAngles: startingAngles,
                collapsed: collapsed,
                angleDragDistance: 0
            }
        } else {
            return null;
        }
    };

    /*
     * Sets segments collapsed or uncollapsed
     */
    DraggablePiechart.prototype.setCollapsed = function(index, collapsed) {

        // Flag to set position of previously collapsed to new location
        var setNewPos = this.data[index].collapsed && !collapsed;

        this.data[index].collapsed = collapsed;

        var visibleSegments = this.getVisibleSegments();

        // Shift other segments along to make space if necessary
        for (var i = 0; i < visibleSegments.length; i += 1) {

            // Start at this segment
            if (visibleSegments[i].index == index) {

                //Set new position
                if (setNewPos) {
                    var nextSegment = visibleSegments[ mod(i + 1, visibleSegments.length) ];
                    this.data[index].angle = nextSegment.angle - this.minAngle;
                }

                for (var j = 0; j < (visibleSegments.length - 1); j += 1) {
                    var currentSegment = visibleSegments[ mod(1 + i - j, visibleSegments.length) ];
                    var nextAlongSegment = visibleSegments[ mod(i - j, visibleSegments.length) ];

                    var angleBetween = Math.abs(smallestSignedAngleBetween(this.data[currentSegment.index].angle, this.data[nextAlongSegment.index].angle) );

                    if (angleBetween < this.minAngle) {
                        this.data[nextAlongSegment.index].angle = normaliseAngle(this.data[currentSegment.index].angle - this.minAngle);
                    }

                }
                break;
            }
        }

        this.draw();
    };

    /*
     * Returns visible segments
     */
    DraggablePiechart.prototype.getVisibleSegments = function() {

        var piechart = this;
        // Collect data for visible segments
        var visibleSegments = [];
        for (var i = 0; i < piechart.data.length; i += 1) {

            if (!piechart.data[i].collapsed) {
                var startingAngle = piechart.data[i].angle;

                // Get arcSize
                var foundNextAngle = false;
                for (var j = 1; j < piechart.data.length; j += 1) {
                    var nextAngleIndex = (i + j) % piechart.data.length;

                    if (!piechart.data[nextAngleIndex].collapsed) {
                        var arcSize = piechart.data[nextAngleIndex].angle - startingAngle;
                        if (arcSize <= 0) { arcSize += TAU; }

                        visibleSegments.push({
                            arcSize: arcSize,
                            angle: startingAngle,
                            format: piechart.data[i].format,
                            index: i
                        });

                        foundNextAngle = true;
                        break;
                    }
                }

                // Only one segment
                if (!foundNextAngle) {
                    visibleSegments.push({
                        arcSize: TAU,
                        angle: startingAngle,
                        format: piechart.data[i].format,
                        index: i
                    });
                    break;
                }
            }

        }
        return visibleSegments;
    };

    /*
     * Returns invisible segments
     */
    DraggablePiechart.prototype.getInvisibleSegments = function() {
        var piechart = this;
        // Collect data for visible segments
        var invisibleSegments = [];
        for (var i = 0; i < piechart.data.length; i += 1) {
            if (piechart.data[i].collapsed) {
                invisibleSegments.push({
                    index: i,
                    format: piechart.data[i].format
                })
            }
        }

        return invisibleSegments;
    };

    /*
     * Draws the piechart
     */
    DraggablePiechart.prototype.draw = function () {
        var piechart = this;
        var context = piechart.context;
        var canvas = piechart.canvas;
        context.clearRect(0, 0, canvas.width, canvas.height);

        var geometry = this.getGeometry();

        var visibleSegments = this.getVisibleSegments();

        // Flags to get arc sizes and index of largest arc, for drawing order
        var largestArcSize = 0;
        var indexLargestArcSize = -1;

        // Get the largeset arcsize
        for (var i = 0; i < visibleSegments.length; i += 1) {
            if (visibleSegments[i].arcSize > largestArcSize) {
                largestArcSize = visibleSegments[i].arcSize;
                indexLargestArcSize = i;
            }
        }


        // Need to draw in correct order
        for (i = 0; i < visibleSegments.length; i += 1) {

            // Start with one *after* largest
            var index = mod(i + indexLargestArcSize + 1, visibleSegments.length);
            piechart.drawSegment(context, piechart, geometry.centerX, geometry.centerY, geometry.radius, visibleSegments[index].angle, visibleSegments[index].arcSize, visibleSegments[index].format, false);
        }

        // Now draw invisible segments
        var invisibleSegments = this.getInvisibleSegments();
        for (i = 0; i < invisibleSegments.length; i += 1) {
            piechart.drawSegment(context, piechart, geometry.centerX, geometry.centerY, geometry.radius, 0, 0, invisibleSegments[i].format, true);
        }

        // Finally draw drag nodes on top (order not important)
        for (i = 0; i < visibleSegments.length; i += 1) {
            var location = polarToCartesian(visibleSegments[i].angle, geometry.radius);
            piechart.drawNode(context, piechart, location.x, location.y, geometry.centerX, geometry.centerY, i == piechart.hoveredIndex);
        }

        piechart.onchange(piechart);

    };

    /*
     * *INTERNAL USE ONLY*
     * Moves the selected angle to a new angle
     */
    DraggablePiechart.prototype.shiftSelectedAngle = function (newAngle) {
        var piechart = this;
        if (!piechart.draggedPie) { return; }
        var draggedPie = piechart.draggedPie;


        // Get starting angle of the target
        var startingAngle = draggedPie.startingAngles[draggedPie.index];

        // Get previous angle of the target
        var previousAngle = piechart.data[draggedPie.index].angle;

        // Get diff from grabbed target start (as -pi to +pi)
        var angleDragDistance = smallestSignedAngleBetween(newAngle, startingAngle);

        // Get previous diff
        var previousDragDistance = draggedPie.angleDragDistance;

        // Determines whether we go clockwise or anticlockwise
        var rotationDirection = previousDragDistance > 0 ? 1 : -1;


        // Reverse the direction if we have done over 180 in either direction
        var sameDirection = previousDragDistance > 0 == angleDragDistance > 0;
        var greaterThanHalf = Math.abs(previousDragDistance - angleDragDistance) > Math.PI;


        if (greaterThanHalf && !sameDirection) {
            // Reverse the angle
            angleDragDistance = (TAU - Math.abs(angleDragDistance)) * rotationDirection;
        } else {
            rotationDirection = angleDragDistance > 0 ? 1 : -1;
        }

        draggedPie.angleDragDistance = angleDragDistance;


        // Set the new angle:
        piechart.data[draggedPie.index].angle = normaliseAngle(startingAngle + angleDragDistance);

        // Reset Collapse
        piechart.data[draggedPie.index].collapsed = draggedPie.collapsed[draggedPie.index];

        // Search other angles
        var shifting = true;
        var collapsed = false;
        var minAngle = piechart.minAngle;
        var numberOfAnglesShifted = 0;

        for (var i = 1; i < piechart.data.length; i += 1) {

            // Index to test each slice in order
            var index = mod(parseInt(draggedPie.index) + (i * rotationDirection), piechart.data.length);

            // Get angle from target start to this angle
            var startingAngleToNonDragged = smallestSignedAngleBetween(draggedPie.startingAngles[index], startingAngle);

            // If angle is in the wrong direction then it should actually be OVER 180
            if (startingAngleToNonDragged * rotationDirection < 0) {
                startingAngleToNonDragged = ((startingAngleToNonDragged * rotationDirection) + TAU) * rotationDirection;
            }

            if (piechart.collapsing) {
                // *Collapsing behaviour* when smallest angle encountered

                // Reset collapse
                piechart.data[index].collapsed = draggedPie.collapsed[index];

                var checkForSnap = !collapsed && !piechart.data[index].collapsed;

                // Snap node to collapse, and prevent going any further
                if (checkForSnap && startingAngleToNonDragged > 0 && angleDragDistance > (startingAngleToNonDragged - minAngle)) {
                    piechart.data[draggedPie.index].angle = piechart.data[index].angle;
                    piechart.data[draggedPie.index].collapsed = true;
                    collapsed = true;
                } else if (checkForSnap && startingAngleToNonDragged < 0 && angleDragDistance < (startingAngleToNonDragged + minAngle)) {
                    piechart.data[draggedPie.index].angle = piechart.data[index].angle;
                    piechart.data[index].collapsed = true;
                    collapsed = true;
                } else {
                    piechart.data[index].angle = draggedPie.startingAngles[index];

                }
            } else {
                // *Shifting behaviour* when smallest angle encountered

                // Shift all other angles along
                var shift = (numberOfAnglesShifted + 1) * minAngle;

                if (shifting && startingAngleToNonDragged > 0 && angleDragDistance > (startingAngleToNonDragged - shift)) {
                    piechart.data[index].angle = normaliseAngle(draggedPie.startingAngles[index] + (angleDragDistance - startingAngleToNonDragged) + shift);
                    numberOfAnglesShifted += 1;
                } else if (shifting && startingAngleToNonDragged < 0 && angleDragDistance < (startingAngleToNonDragged + shift)) {
                    piechart.data[index].angle = normaliseAngle(draggedPie.startingAngles[index] - (startingAngleToNonDragged - angleDragDistance) - shift);
                    numberOfAnglesShifted += 1;
                } else {
                    shifting = false;
                    piechart.data[index].angle = draggedPie.startingAngles[index];
                }
            }

            //console.log(JSON.stringify(piechart.data));

        }


    };

    DraggablePiechart.prototype.defaults = {

        onchange: function(piechart) {},
        radius: 0.9,
            data: [
        { angle: -2, format: { color: "#2665da", label: 'Walking'}, collapsed: false },
        { angle: -1, format: { color: "#6dd020", label: 'Programming'}, collapsed: false },
        { angle: 0, format: { color: "#f9df18", label: 'Chess'}, collapsed: false },
        { angle: 1, format: { color: "#d42a00", label: 'Eating'}, collapsed: false },
        { angle: 2, format: { color: "#e96400", label: 'Sleeping'}, collapsed: false }],
        collapsing: false,
        minAngle: 0.1,

        drawSegment: function(context, piechart, centerX, centerY, radius, startingAngle, arcSize, format, collapsed) {

            if (collapsed) { return; }

            // Draw coloured segment
            context.save();
            var endingAngle = startingAngle + arcSize;
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.arc(centerX, centerY, radius,
                startingAngle, endingAngle, false);
            context.closePath();

            context.fillStyle = format.color;
            context.fill();
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
        },

        drawNode: function (context, piechart, x, y, centerX, centerY, hover) {

            context.save();
            context.translate(centerX, centerY);
            context.fillStyle = '#DDDDDD';

            var rad = hover ? 7 : 5;
            context.beginPath();
            context.arc(x, y, rad, 0, TAU, true);
            context.fill();
            context.stroke();
            context.restore();
        }
    };

    window.DraggablePiechart = DraggablePiechart;

    /*
     * Utilities + Constants
     */

    var TAU = Math.PI * 2;

    function degreesToRadians(degrees) {
        return (degrees * Math.PI)/180;
    }

    function smallestSignedAngleBetween(target, source) {
        return Math.atan2(Math.sin(target-source), Math.cos(target-source));
    }

    function mod(n, m) {
        return ((n % m) + m) % m;
    }

    function is_touch_device() {
        return 'ontouchstart' in window        // works on most browsers
            || navigator.maxTouchPoints;       // works on IE10/11 and Surface
    }

    function normaliseAngle(angle) {
        return mod(angle + Math.PI, TAU) - Math.PI;
    }

    function polarToCartesian(angle, radius) {
        return {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        }
    }
    
})();

