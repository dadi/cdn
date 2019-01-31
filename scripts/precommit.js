#!/usr/bin/env node

const exec = require('child_process').exec

function currentBranch () {
  return new Promise((resolve, reject) => {
    exec('git branch --no-color', (err, out) => {
      if (err) return reject(err)

      let branches = out.split('\n')
      let branch = branches.find(branch => {
        return /^\*/.test(branch)
      })

      branch = branch.replace('*', '')
      branch = branch.trim()

      return resolve(branch)
    })
  })
}

currentBranch().then(branch => {
  console.log('Checking valid branch name...')

  if (branch !== 'master' &&
    branch !== 'develop' &&
    !/^feature\//.test(branch) &&
    !/^patch\//.test(branch) &&
    !/^release-/.test(branch)
  ) {
    console.log()
    console.log('Branch name invalid.')
    console.log('Please use topic branches named "feature/...", or "patch/..."')
    console.log()

    process.exit(1)
  } else {
    console.log('Branch name OK.')
    process.exit(0)
  }
})
