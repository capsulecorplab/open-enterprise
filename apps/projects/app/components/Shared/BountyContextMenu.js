import React from 'react'
import styled, { css } from 'styled-components'
import { ContextMenuItem, GU, theme } from '@aragon/ui'
import { usePanelManagement } from '../Panel'
import { issueShape } from '../../utils/shapes.js'

const BountyContextMenu = ({ issue }) => {
  const { workStatus } = issue
  const {
    allocateBounty,
    editBounty,
    requestAssignment,
    reviewApplication,
    reviewWork,
    submitWork,
    viewFunding,
  } = usePanelManagement()

  return (
    <React.Fragment>
      {workStatus === undefined && (
        <Item onClick={() => allocateBounty([issue])}>Fund Issue</Item>
      )}
      {workStatus === 'in-progress' && (
        <React.Fragment>
          <Item onClick={() => submitWork(issue)}>Submit Work</Item>
          <Item bordered onClick={() => viewFunding(issue)}>
            View Funding Proposal
          </Item>
        </React.Fragment>
      )}
      {workStatus === 'review-work' && (
        <React.Fragment>
          <Item onClick={() => reviewWork(issue)}>Review Work</Item>
          <Item bordered onClick={() => viewFunding(issue)}>
            View Funding Proposal
          </Item>
        </React.Fragment>
      )}
      {workStatus === 'funded' && (
        <React.Fragment>
          <Item onClick={() => requestAssignment(issue)}>
            Request Assignment
          </Item>
          <Item bordered onClick={() => editBounty([issue])}>
            Update Funding
          </Item>
          <Item onClick={() => viewFunding(issue)}>View Funding Proposal</Item>
        </React.Fragment>
      )}
      {workStatus === 'review-applicants' && (
        <React.Fragment>
          <Item onClick={() => reviewApplication(issue)}>
            Review Application {issue.requestsData ? `(${issue.requestsData.length})` : ''}
          </Item>
          <Item bordered onClick={() => editBounty([issue])}>
            Update Funding
          </Item>
          <Item onClick={() => viewFunding(issue)}>View Funding Proposal</Item>
        </React.Fragment>
      )}
      {workStatus === 'fulfilled' && (
        <Item onClick={() => viewFunding(issue)}>View Funding Proposal</Item>
      )}
    </React.Fragment>
  )
}

const Item = styled(ContextMenuItem)`
  ${props =>
    props.bordered &&
    css`
      border-top: 1px solid ${theme.shadow};
      margin-top: 10px;
    `};
  padding: ${1 * GU}px ${2 * GU}px;
`

BountyContextMenu.propTypes = issueShape

export default BountyContextMenu
