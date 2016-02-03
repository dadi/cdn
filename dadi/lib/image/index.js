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

 function Image(){
   this.load = function(buffer, type){
     return new Promise(function(resolve, reject){
       openByFormat = {
         'jpg': gd.createFromJpegPtr,
         'jpeg': gd.createFromJpegPtr,
         'png': gd.createFromPngPtr,
         'gif': gd.createFromGifPtr
       };

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

   this.save = function(){

   };
 }

 module.exports = function(){
   return new Image();
 };
