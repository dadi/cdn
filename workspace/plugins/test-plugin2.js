module.exports.pre = ({options, url}) => {
  console.log('')
  console.log('*** PLUGIN options:', options)
  console.log('')

  // options.width = 200
  // options.height = 200
  // options.resizeStyle = 'entropy'
}

module.exports.post = ({jsonData, options, processor, stream, url}) => {
  processor.blur(15)
}
