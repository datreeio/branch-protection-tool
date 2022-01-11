const {GithubClient} = require("./GitbhuClient")

const TOKEN = process.env.TOKEN
const OWNER = process.env.OWNER


async function run() {
  const githubClient = new GithubClient(TOKEN)

  let repos = await githubClient.listRepositories(OWNER)
  const reposCount = repos.length

  console.log(`Retrieved ${reposCount} repositories`)

  let updatedRepos = 0

  for (const repo of repos) {
    await githubClient.removeDatreeChecksFromBranchProtection({
      owner: OWNER,
      repositoryName: repo.name,
      branch: repo.defaultBranch
    })

    updatedRepos += 1

    console.log(`removed datree checks from repository: ${repo.name}. ${updatedRepos}/${reposCount}`)
  }

}

run()
  .then(() => {
    console.log('done')
  }).catch(err => {
  console.error(err)
})