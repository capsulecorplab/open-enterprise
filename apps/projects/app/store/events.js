import { ipfsGet } from '../utils/ipfs-helpers'

import {
  ACTION_PERFORMED,
  REQUESTING_GITHUB_TOKEN,
  REQUESTED_GITHUB_TOKEN_SUCCESS,
  REQUESTED_GITHUB_TOKEN_FAILURE,
  REQUESTED_GITHUB_DISCONNECT,
  REPO_ADDED,
  REPO_REMOVED,
  BOUNTY_ADDED,
  ASSIGNMENT_REQUESTED,
  ASSIGNMENT_APPROVED,
  ASSIGNMENT_REJECTED,
  BOUNTY_FULFILLED,
  BOUNTY_SETTINGS_CHANGED,
  VAULT_DEPOSIT,
} from './eventTypes'

import { INITIAL_STATE } from './'

import {
  initializeGraphQLClient,
  syncRepos,
  loadReposFromQueue,
  loadIssueData,
  loadIpfsData,
  buildSubmission,
  determineWorkStatus,
  updateIssueDetail,
  syncIssues,
  syncTokens,
  syncSettings
} from './helpers'

import { STATUS } from '../utils/github'

import { app } from './app'

export const handleEvent = async (state, action, vaultAddress, vaultContract) => {
  const { event, returnValues, address } = action

  switch (event) {
  case REQUESTING_GITHUB_TOKEN: {
    return state
  }
  case REQUESTED_GITHUB_TOKEN_SUCCESS: {
    const { token } = returnValues
    if (token) {
      initializeGraphQLClient(token)
    }

    const loadedRepos = await loadReposFromQueue(state)

    const status = STATUS.AUTHENTICATED
    state.github = {
      token,
      status,
      event: null
    }
    state.repos = [ ...state.repos, ...loadedRepos ]

    return state
  }
  case REQUESTED_GITHUB_TOKEN_FAILURE: {
    return state
  }
  case REQUESTED_GITHUB_DISCONNECT: {
    state.github = INITIAL_STATE.github
    state.repos = [] // repos will be reloaded from loadReposFromQueue on re-sign-in
    return state
  }
  case REPO_ADDED: {
    return await syncRepos(state, returnValues)
  }
  case REPO_REMOVED: {
    const id = returnValues.repoId
    const repoIndex = state.repos.findIndex(repo => repo.id === id)
    if (repoIndex === -1) return state
    state.repos.splice(repoIndex,1)
    return state
  }
  case BOUNTY_ADDED: {
    if(!returnValues) return state
    const { repoId, issueNumber, ipfsHash } = returnValues
    const ipfsData = await loadIpfsData(ipfsHash)
    let issueData = await loadIssueData({ repoId, issueNumber })
    issueData = { ...issueData, ...ipfsData }
    issueData = determineWorkStatus(issueData)
    return syncIssues(state, returnValues, issueData)
  }
  case ASSIGNMENT_REQUESTED: {
    if(!returnValues) return state
    const { repoId, issueNumber } = returnValues
    let issueData = await loadIssueData({ repoId, issueNumber })
    issueData = await updateIssueDetail(issueData)
    issueData = determineWorkStatus(issueData)
    return syncIssues(state, returnValues, issueData)
  }
  case ASSIGNMENT_APPROVED: {
    if(!returnValues) return state
    const { repoId, issueNumber } = returnValues
    let issueData = await loadIssueData({ repoId, issueNumber })
    issueData = await updateIssueDetail(issueData)
    issueData = determineWorkStatus(issueData)
    return syncIssues(state, returnValues, issueData)
  }
  case ASSIGNMENT_REJECTED: {
    if(!returnValues) return state
    const { repoId, issueNumber } = returnValues
    let issueData = await loadIssueData({ repoId, issueNumber })
    issueData = await updateIssueDetail(issueData)
    issueData = determineWorkStatus(issueData)
    return syncIssues(state, returnValues, issueData)
  }
  case BOUNTY_FULFILLED: {
    if(!returnValues) return state
    const { _bountyId, _fulfillmentId, _fulfillers, _submitter, _data } = returnValues
    const issue = state.issues.find(i => i.data.standardBountyId === _bountyId)
    if (!issue) return state

    if (
      issue.data.workSubmissions &&
      issue.data.workSubmissions[_fulfillmentId] &&
      issue.data.workSubmissions[_fulfillmentId].review
    ) {
      // this indicates that blocks are being processed out of order,
      // and ACTION_PERFORMED has already marked this submission as reviewed
      return state
    }

    const issueNumber = String(issue.data.number)
    const submission = await buildSubmission({
      fulfillmentId: _fulfillmentId,
      fulfillers: _fulfillers,
      submitter: _submitter,
      ipfsHash: _data,
    })

    const workSubmissions = issue.data.workSubmissions || []
    workSubmissions[_fulfillmentId] = submission

    let issueData = {
      ...issue.data,
      workSubmissions,
      work: submission,
    }
    issueData = await updateIssueDetail(issueData)
    issueData = determineWorkStatus(issueData)
    return syncIssues(state, { issueNumber }, issueData)
  }
  case ACTION_PERFORMED: {
    if (!returnValues) return state
    const { _bountyId, _data, _fulfiller } = returnValues
    const { appAddress } = await app.currentApp().toPromise()
    if (_fulfiller.toLowerCase() !== appAddress.toLowerCase()) return state

    const issue = state.issues.find(i =>
      i.data.standardBountyId === _bountyId
    )
    if (!issue) return state

    const ipfsData = await ipfsGet(_data)

    // we only care about ActionPerformed when called in ReviewSubmission
    if (!ipfsData.fulfillmentId) return state

    const workSubmissions = issue.data.workSubmissions || []
    workSubmissions[ipfsData.fulfillmentId] = ipfsData

    let issueData = {
      ...issue.data,
      workSubmissions,
      work: ipfsData,
    }
    issueData = await updateIssueDetail(issueData)
    issueData = determineWorkStatus(issueData)
    const issueNumber = String(issue.data.number)
    return syncIssues(state, { issueNumber }, issueData)
  }
  case BOUNTY_SETTINGS_CHANGED:
    state = await syncSettings(state) // No returnValues on this
    return await syncTokens(state, { token: state.bountySettings.bountyCurrency }, vaultContract )
  case VAULT_DEPOSIT:
    if (vaultAddress !== address) return state
    return await syncTokens(state, returnValues, vaultContract)
  default:
    return state
  }
}
