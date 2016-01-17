# DADI CDN

### JavaScript and CSS examples

#### Example #1: JavaScript

Convert from one format to another with quality control.

**Request**

`http(s)://your-domain.media/js/1/path/to/javascript.js`

**Input**

	/**
	 * Says hello
	 */
	
	// display prompt box that ask for name and
	// store result in a variable called who
	var who = window.prompt("What is your name");
	
	// display prompt box that ask for favorite color and
	// store result in a variable called favcolor
	var favcolor = window.prompt("What is your favorite color");
	
	// write "Hello" followed by person' name to browser window
	document.write("Hello " + who);
	
	// Change background color to their favorite color
	document.bgColor = favcolor;

**Output**

	var who=window.prompt("What is your name");var favcolor=window.prompt("What is your favorite color");document.write("Hello "+who);document.bgColor=favcolor;

#### Example #2: CSS

**Request**

`http(s)://your-domain.media/css/1/path/to/css.css`

**Input**

	body {
	  background-color: silver;
	  color: white;
	  padding: 20px;
	  font-family: Arial, Verdana, sans-serif;}
	h1 {
	  background-color: #ffffff;
	  background-color: hsla(0,100%,100%,0.5);
	  color: #64645A;
	  padding: inherit;}
	p {
	  padding: 5px;
	  margin: 0px;}
	p.zero {
	  background-color: rgb(238,62,128);}
	p.one {
	  background-color: rgb(244,90,139);}
	p.two {
	  background-color: rgb(243,106,152);}
	p.three {
	  background-color: rgb(244,123,166);}
	p.four {
	  background-color: rgb(245,140,178);}
	p.five {
	  background-color: rgb(246,159,192);}
	p.six {
	  background-color: rgb(245,176,204);}

**Output**

	body{background-color:silver;color:white;padding:20px;font-family:Arial,Verdana,sans-serif}h1{background-color:#fff;background-color:hsla(0,100%,100%,0.5);color:#64645A;padding:inherit}p{padding:5px;margin:0}p.zero{background-color:rgb(238,62,128)}p.one{background-color:rgb(244,90,139)}p.two{background-color:rgb(243,106,152)}p.three{background-color:rgb(244,123,166)}p.four{background-color:rgb(245,140,178)}p.five{background-color:rgb(246,159,192)}p.six{background-color:rgb(245,176,204)}
