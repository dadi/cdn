/*
 Options list
 format:[e.g. png, jpg]
 quality: [integer, 0>100]
 trim: [boolean 0/1]
 trimFuzz: [boolean 0/1]
 width: [integer]
 height: [integer]
 cropX: [integer]
 cropY: [integer]
 ratio: [String]
 devicePixelRatio: [integer]
 resizeStyle: [aspectfill/aspectfit/fill]
 gravity: ['NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast', 'None']
 filter: [e.g. 'Lagrange', 'Lanczos', 'none']
 blur: [integer 0>1, e.g. 0.8]
 strip: [boolean 0/1]
 rotate: [degrees]
 flip: [boolean 0/1]
 */

 var gd = require('node-gd');
 var filetype = require('file-type');

 function Image(){
   //load image by format
   this.load = function(buffer, type){
     return new Promise(function(resolve, reject){
       openByFormat = {
         'jpg': gd.createFromJpegPtr,
         'jpeg': gd.createFromJpegPtr,
         'png': gd.createFromPngPtr,
         'gif': gd.createFromGifPtr
       };

       if(typeof buffer === 'string'){
         console.log('Buffer was a string');
         buffer = new Buffer(buffer, 'utf8');
         console.log(typeof buffer);
         console.log(filetype(buffer));
       }

       if(!type){
         type = filetype(buffer).ext;
       }

       var ptr = openByFormat[type](buffer);
       if(ptr && ptr instanceof gd.Image){
         return resolve(ptr);
       }else{
         return reject(ptr || new Error('Failed to load image'));
       }
     });
   };

   this.blur = function(){

   };

   this.flip = function(){

   };

   this.rotate = function(){

   };

   this.crop = function(){

   };
   //returns the raw encoded image
   this.save = function(img, type, quality){
     return new Promise(function(resolve, reject){
       var formats = {
         'gif': 'gifPtr',
         'jpg': 'jpegPtr',
         'jpeg': 'jpegPtr',
         'png': 'pngPtr'
       };
       if(type !== 'jpg' || type !== 'jpeg') quality = null;
       if(!formats[type]) return reject(new Error('Unsupported format'));
       var data = img[formats[type]](); //this is scary, I know
       return resolve(data);
     });
   };
 }

 module.exports = function(){
   return new Image();
 };
