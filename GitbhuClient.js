const octokit = require('@octokit/rest')
const getProperty = require('lodash.get')

const DATREE_CHECKS = {
  POLICY: "Datree Smart Policy",
  INSIGHTS: "Datree insights"
}

class GithubClient {
  constructor(token) {
    this.client = new octokit({
      previews: [
        'application/vnd.github.drax-preview+json',
        'application/vnd.github.luke-cage-preview+json',
        'application/vnd.github.fury-preview+json',
        'application/vnd.github.machine-man-preview+json'
      ],
      async auth() {
        return token
      }
    })
  }

  async removeDatreeChecksFromBranchProtection({
                                                 owner,
                                                 repositoryName,
                                                 branch,
                                               }) {
    // initialize branch protection settings

    let protectionSettingsData = await this._getBranchProtection({owner, repositoryName, branch})

    if (!protectionSettingsData) protectionSettingsData = {}

    //  enforce_admins initialization
    let enforceAdmins = null
    if (protectionSettingsData.enforce_admins) {
      enforceAdmins = protectionSettingsData.enforce_admins.enabled
    }


    const required_status_checks = this.removeDatreeChecks(
      protectionSettingsData
    )

    // restrictions initialization
    let restrictions = protectionSettingsData.restrictions || null

    if (restrictions) {
      restrictions = {
        users: protectionSettingsData.restrictions.users
          ? protectionSettingsData.restrictions.users.map(user => user.login)
          : [],
        teams: protectionSettingsData.restrictions.teams
          ? protectionSettingsData.restrictions.teams.map(team => team.slug)
          : []
      }
    }

    return await this.client.repos.updateBranchProtection({
      owner,
      repo: repositoryName,
      branch,
      enforce_admins: enforceAdmins,
      required_status_checks,
      required_pull_request_reviews: protectionSettingsData.required_pull_request_reviews || null,
      restrictions,
      allow_force_pushes: protectionSettingsData.allow_force_pushes
        ? protectionSettingsData.allow_force_pushes.enabled
        : false,
      allow_deletions: protectionSettingsData.allow_deletions ? protectionSettingsData.allow_deletions.enabled : false
    })
  }

  async listRepositories(org) {
    const repos = await this._paginate(this.client.repos.listForOrg({org}))

    return repos.map(repo => {
      return {
        url: repo.html_url,
        private: repo.private,
        forked: repo.fork,
        archived: repo.archived,
        owner: repo.owner.login,
        name: repo.name,
        id: repo.id,
        defaultBranch: repo.default_branch
      }
    })
  }

  async _paginate(prom, resourceKey = 'data') {
    let response = await prom
    let resourceList = getProperty(response, resourceKey)
    while (this.client.hasNextPage(response)) {
      response = await this.client.getNextPage(response)
      resourceList = resourceList.concat(getProperty(response, resourceKey))
    }
    return resourceList
  }

  async _getBranchProtection({owner, repositoryName, branch}) {
    let branchProtection
    try {
      const {data} = await this.client.repos.getBranchProtection({owner, repo: repositoryName, branch})
      branchProtection = data
    } catch (err) {
      if (err.code === 404 && err.message === 'Branch not protected') {
        branchProtection = undefined
      } else if (
        err.code === 403 &&
        err.message === 'Upgrade to GitHub Pro or make this repository public to enable this feature.'
      ) {
        branchProtection = undefined
      } else {
        throw err
      }
    }

    return branchProtection
  }

  removeDatreeChecks(
    githubBranchProtectionSettings
  ) {

    if (!githubBranchProtectionSettings.required_status_checks || !githubBranchProtectionSettings.required_status_checks.checks) {
      return null
    }

    let requiredStatusChecks = {contexts: [], strict: true}
    if (githubBranchProtectionSettings && githubBranchProtectionSettings.required_status_checks) {
      requiredStatusChecks = githubBranchProtectionSettings.required_status_checks
    }

    requiredStatusChecks = this._removeCheckFromRequiredStatusChecks(
      requiredStatusChecks,
      DATREE_CHECKS.POLICY
    )

    requiredStatusChecks = this._removeCheckFromRequiredStatusChecks(
      requiredStatusChecks,
      DATREE_CHECKS.INSIGHTS
    )

    requiredStatusChecks.checks = requiredStatusChecks.checks.filter(c => ![DATREE_CHECKS.POLICY, DATREE_CHECKS.INSIGHTS].includes(c.context))

    if (!requiredStatusChecks.checks || requiredStatusChecks.checks.length === 0) requiredStatusChecks = null

    return requiredStatusChecks
  }

  _removeCheckFromRequiredStatusChecks(statusChecks, checkName) {
    if (statusChecks && statusChecks.contexts) {
      statusChecks.contexts = statusChecks.contexts.filter(context => context !== checkName)
    }

    return statusChecks
  }
}

module.exports = {GithubClient}

