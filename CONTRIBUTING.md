# DADI CDN

## Contributing

We'd love for you to contribute to our source code and to make DADI CDN even better.

Here are the guidelines we'd like you to follow:

 - [Question or Problem?](#question)
 - [Issues and Bugs](#issue)
 - [Feature Requests](#feature)
 - [Submission Guidelines](#submit)
 - [Coding Rules](#rules)
 - [Git Commit Guidelines](#commit)

## <a name="question"></a> Got a Question or Problem?

Documentation is maintained under the `docs` branch and can be found on the [dadi.tech](https://dadi.tech) site.

If the documentation doesn't answer your problem please feel free to email the
DADI team directly on: team@dadi.tech

## <a name="issue"></a> Found an Issue?
If you find a bug in the source code or a mistake in the documentation, you can help us by
submitting an issue to our [GitHub Repository][github]. But we'd love it if you
submitted a Pull Request with a fix instead!

**Please see the Submission Guidelines below**.

## <a name="feature"></a> Want a Feature?
You can request a new feature by submitting an issue to our [GitHub][issues] issue tracker.
If you would like to implement a new feature then consider what kind of change it is:

* **Major Changes** that you wish to contribute to the project should be added as
a Feature Request in the [GitHub][issues] issue tracker. This will get the conversation
started.
* **Small Changes** can be crafted and submitted to the [GitHub Repository][github] as a Pull Request.

## <a name="submit"></a> Submission Guidelines

### Submitting an Issue
Before you submit your issue [search the archive][issues], maybe your question was already answered.

If your issue appears to be a bug, and hasn't been reported, open a new issue.
Help us to maximize the effort we can spend fixing issues and adding new
features, by not reporting duplicate issues.  Providing the following information will increase the
chances of your issue being dealt with quickly:

* **Overview of the Issue** - if an error is being thrown a non-minified stack trace helps
* **Motivation for or Use Case** - explain why this is a bug for you
* **DADI CDN Version**
* **Operating System**
* **Steps to Reproduce** - provide a set of steps to follow to reproduce the error.
* **Related Issues** - has a similar issue been reported before?
* **Suggest a Fix** - if you can't fix the bug yourself, perhaps you can point to what might be
  causing the problem (e.g. a line of code or a commit)

### Submitting a Pull Request
Before you submit your pull request consider the following guidelines:

* Search [GitHub][pulls] for an open or closed Pull Request
  that relates to your submission. You don't want to duplicate effort.
* Fork the original repository and clone your fork ([see this GitHub article](https://help.github.com/articles/fork-a-repo/)).
* Add the original repository as an upstream remote: `git remote add upstream https://github.com/dadi/cdn.git`

* Make your changes in a new git branch. Name your branch using the format `topic/branch_name`.
Use `fix` for fixes and `feature` for features:

 ```shell
 git checkout -b fix/my-fix-branch master
 ```
 ```shell
 git checkout -b feature/my-new-feature-branch master
 ```

* Create your patch, **including appropriate test cases**.
* Follow our [Coding Rules](#rules).
* Run the full test suite using `npm test` and ensure that all tests pass.
* Commit your changes using a descriptive commit message that follows our
  [commit message conventions](#commit-message-format) and passes our commit message presubmit hook. Adherence to the [commit message conventions](#commit-message-format) is required because release notes are automatically generated from these messages.
* Push your branch to GitHub:

  ```shell
  git push origin fix/my-fix-branch
  ```

* In GitHub, send a pull request to `dadi/cdn:master`.
* If we suggest changes then:
  * Make the required updates.
  * Re-run the full test suite to ensure tests are still passing.
  * Commit your changes to your branch (e.g. `fix/my-fix-branch`).
  * Push the changes to GitHub (this will update your Pull Request).

If the pull request gets too outdated we may ask you to rebase and force push to update the pull request:

```shell
git rebase master -i
git push origin fix/my-fix-branch -f
```

*WARNING. Squashing or reverting commits and forced push thereafter may remove GitHub comments on code that were previously made by you and others in your commits.*

* Documentation! Please add relevant documentation to the pull request. If this is a new feature then
please document it fully within the pull request. If you're making changes to an existing feature, please
give us a link to the existing [documentation][docs] along with your documentation changes. If you need
an example of excellent pull request documentation, have a look at the [effort put in here](https://github.com/dadi/api/pull/27).

> That's it! Thank you for your contribution!

#### After your pull request is merged

After your pull request is merged, you can safely delete your branch and pull the changes from the main (upstream) repository:

* Delete the remote branch on GitHub either through the GitHub web UI or your local shell as follows:

  ```shell
  git push origin --delete my-fix-branch
  ```

* Check out the master branch:

  ```shell
  git checkout master -f
  ```

* Delete the local branch:

  ```shell
  git branch -D my-fix-branch
  ```

* Update your master with the latest upstream version:

  ```shell
  git pull --ff upstream master
  ```

## <a name="rules"></a> Coding Rules
To ensure consistency throughout the source code, keep these rules in mind as you are working:

* Please use **two-space indentation**, as used in Node.JS itself.
* All features or bug fixes **must be tested** by one or more tests. Browse the [test
suite][tests] for examples.
* All public API methods **must be documented** with [JSDoc](http://usejsdoc.org/).

## <a name="commit"></a> Git Commit Guidelines

### One Change Per Commit

A commit should contain exactly one logical change. A logical change includes adding a new feature, fixing a specific bug, etc. If it's not possible to describe the high level change in a few words, it is most likely too complex for a single commit. The diff itself should be as concise as reasonably possibly and it's almost always better to err on the side of too many patches than too few. As a rule of thumb, given only the commit message, another developer should be able to implement the same patch in a reasonable amount of time.

Please don't include more than one change in each patch. If your commit message requires an "and" in the middle, it's likely you need separate commits.

### Commit Message Format

We have very precise rules over how our git commit messages can be formatted. This leads to **more readable messages** that are easy to follow when looking through the **project history**.  We also use the git commit messages to **generate the change log**.

The commit message format validation can be initialised by running `npm run init` from the root of the repository. This will add a symlink at `.git/hooks/commit-msg` which will be run every time you commit.

#### Line Length

Any line of the commit message cannot be longer 100 characters. This allows the message to be easier to read on GitHub as well as in various git tools.

#### Message Format

Each commit message consists of a **header**, a **body** and a **footer**.  The header has a special format that includes a **type** and a **subject**:

```
type: subject

Optional long description

Fix #xxx
Close #yyy
Ref #zzz
```

* Use `Fix #xxx` when the commit fixes an open issue.
* Use `Close #xxx` when the commit closes an open pull request.
* Use `Ref #xxx` when referencing an issue or pull request that is already closed or should remain open. Examples include partial fixes and commits that add a test but not a fix.

### Reverting
If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Type
Must be one of the following:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **perf**: A code change that improves performance
* **test**: Adding missing tests
* **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Subject
The subject contains a succinct description of the change:

* use the imperative, present tense: "fix" not "fixed" nor "fixes"
* don't capitalize first letter
* no dot (.) at the end

### Body
Just as in the **subject**, write your commit message in the imperative: "Fix bug" and not "Fixed bug" or "Fixes bug". This convention matches up with commit messages generated by commands like `git merge` and `git revert`.

The body should include the motivation for the change and contrast this with previous behavior.

### Footer
The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.


[github]: https://github.com/dadi/cdn
[issues]: https://github.com/dadi/cdn/issues
[pulls]: https://github.com/dadi/cdn/pulls
[tests]: https://github.com/dadi/cdn/tree/master/test
[docs]: https://github.com/dadi/cdn/tree/docs/

