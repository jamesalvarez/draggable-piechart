# draggable-piechart
A javascript class for interactive draggable pie charts on HTML5 canvas

* Works with both touch / mouse devices
* Customise the drawing of the chart

If you are looking for a customisable class to render interactive pie charts, then possibly your search is at an end.  

## Online examples:

See the blog post on my website: [http://jamesalvarez.co.uk/uncategorized/draggable-piechart-js-class/](http://jamesalvarez.co.uk/uncategorized/draggable-piechart-js-class/)

## Getting started

Creating the default piechart is easy, just create a new object passing in a canvas:

```
var newPie = new DraggablePiechart({canvas: document.getElementById('piechart')});
```

## Passing in custom data

Data can be passed in as proportions:

```
var proportions = [
	{ proportion: 50, format: { color: "#2665da", label: 'Cats'}},
	{ proportion: 50, format: { color: "#6dd020", label: 'Dogs'}} ];
	
var newPie = new DraggablePiechart({
	canvas: document.getElementById('piechart'), 
	proportions: proportions
});
```

Data can be passed in raw, which gives the angle for each inter-segment, and it's state whether it's collapsed:

```
var data = [
	{ angle: 0, format: { color: "#2665da", label: 'Cats'}, collapsed: false },
	{ angle: Math.PI, format: { color: "#6dd020", label: 'Dogs'}, collapsed: false }];
	
var newPie = new DraggablePiechart({
	canvas: document.getElementById('piechart'),
	data: data
});
```

## Collapsing behaviour

Setting the collapsing option to true will cause segments to be collapsed when dragged to zero size.  You will need to provide a way of uncollapsing segments if this is the case, with a call to setCollapsed().

```
var newPie = new DraggablePiechart({
	canvas: document.getElementById('piechart'), 
	collapsing: true,  // elements will collapse when dragged to zero
	minAngle: 0.1 // minimum angle in rads for a segment
});
```

Setting the collapsing option to false will prevent this, and just shift around the segments in the way:

```
var newPie = new DraggablePiechart({
	canvas: document.getElementById('piechart'), 
	collapsing: false,  // elements will not collapse 
	minAngle: 0.1 // minimum angle in rads for a segment
});
```

## Custom formatting

You can pass in custom functions to draw the pie's segments and drag indicators - for an example of this, see example.js.  

## Getting the result

You can provide a callback, which is fired everytime the pie is adjusted, and there are functions to get the percentages indicated by the pie, e.g.:

```
var newPie = new DraggablePiechart({
	canvas: document.getElementById('piechart'), 
	onchange: onPieChartChange
});

function onPieChartChange(piechart) {
	// get the percentage for the first slice
	var firstPercentage = piechart.getSliceSizePercentage(0);
	
	// get all percentages
	var percentages = piechart.getAllSliceSizePercentages();
}
```


