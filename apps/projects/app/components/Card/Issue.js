import PropTypes from 'prop-types'
import React from 'react'
import styled from 'styled-components'

import { Text, Tag, Checkbox, ContextMenu, useTheme, IconClock, IconConnect, IconCalendar } from '@aragon/ui'

import { formatDistance } from 'date-fns'
import { BountyContextMenu } from '../Shared'
import { BOUNTY_STATUS, BOUNTY_BADGE_COLOR } from '../../utils/bounty-status'
import { IconBarbell } from '../../assets'

const DeadlineDistance = date =>
  formatDistance(new Date(date), new Date(), { addSuffix: true })

const dot = <span css="margin: 0px 10px">&middot;</span>

const labelsTags = (labels, theme) =>
  labels.edges.map(label => (
    <Tag
      key={label.node.id}
      css="margin-right: 10px; width: auto"
      background={'#' + label.node.color + '99'}
      color={`${theme.surfaceContent}`}
    >
      {label.node.name}
    </Tag>
  ))

const Issue = ({ isSelected, onClick, onSelect, ...issue }) => {
  const theme = useTheme()
  const {
    workStatus,
    title,
    repo,
    number,
    labels,
    balance = 10,
    symbol = 'AUT',
    deadline = '2019-10-23 00:00',
    expLevel = 'easy',
    createdAt,
  } = issue

  return (
    <StyledIssue theme={theme}>
      <div css="padding: 20px 10px">
        <Checkbox checked={isSelected} onChange={() => onSelect(issue)} />
      </div>

      <IssueData>
        <IssueMain>
          <div css="display: flex;">
            <a
              href={`#${number}`}
              css="text-decoration: none"
              onClick={e => {
                e.preventDefault()
                onClick(issue)
              }}
            >
              <IssueTitle theme={theme}>{title}</IssueTitle>
            </a>

            {labels.totalCount > 0 && (
              <div>
                {labelsTags(labels, theme)}
              </div>
            )}
          </div>

          <div css="display: flex;">
            <Balance>
              {BOUNTY_STATUS[workStatus] && (
                <Tag
                  css="padding: 10px; margin-right: 10px;"
                  background={BOUNTY_BADGE_COLOR[workStatus].bg}
                  color={BOUNTY_BADGE_COLOR[workStatus].fg}
                >
                  {balance + ' ' + symbol}
                </Tag>
              )}
            </Balance>

            <ContextMenu>
              <BountyContextMenu issue={issue} />
            </ContextMenu>
          </div>
        </IssueMain>

        <IssueDetails>
          <Text.Block color={`${theme.surfaceContentSecondary}`} size="small">
            <span css="font-weight: 600; white-space: nowrap">{repo} #{number}</span>
            {dot}
            <span css="white-space: nowrap">
              <IconClock color={`${theme.surfaceIcon}`} css="margin-bottom: -8px; margin-right: 4px" />
            opened {DeadlineDistance(createdAt)}
            </span>
            {BOUNTY_STATUS[workStatus] && (
              <React.Fragment>
                {dot}
                <span css="white-space: nowrap">
                  <IconConnect color={`${theme.surfaceIcon}`} css="margin-bottom: -8px" /> {balance > 0
                    ? BOUNTY_STATUS[workStatus]
                    : BOUNTY_STATUS['fulfilled']}
                </span>

                {dot}
                <span css="white-space: nowrap">
                  <div css={`
                  display: inline-block;
                  vertical-align: bottom;
                  margin-right: 6px;
                  margin-bottom: -8px;
                `}>
                    <IconBarbell color={`${theme.surfaceIcon}`} />
                  </div>
                  {expLevel}
                </span>

                {dot}
                <span css="white-space: nowrap">
                  <IconCalendar color={`${theme.surfaceIcon}`} css="margin-bottom: -8px; margin-right: 4px" />
                Due {DeadlineDistance(deadline)}
                </span>
              </React.Fragment>
            )}
          </Text.Block>
        </IssueDetails>
      </IssueData>
    </StyledIssue>
  )
}

Issue.propTypes = {
  title: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  number: PropTypes.number.isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  workStatus: PropTypes.oneOf([
    undefined,
    'funded',
    'review-applicants',
    'in-progress',
    'review-work',
    'fulfilled',
  ]),
  work: PropTypes.object,
}

const StyledIssue = styled.div`
  width: 100%;
  background: ${props => props.theme.background};
  background-color: ${props => props.theme.surface};
  display: flex;
  height: auto;
  align-items: flex-start;
  border: 1px solid ${props => props.theme.border};
  margin-bottom: -1px;
  position: relative;
  :first-child {
    border-radius: 3px 3px 0 0;
  }
  :last-child {
    border-radius: 0 0 3px 3px;
  }
`
const IssueData = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 18px 18px 18px 0;
  position: relative;
  width: 100%;
`
const IssueDetails = styled.div`
  display: flex;
  align-items: center;
`
const IssueMain = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`
const Balance = styled.div`
  margin-left: 10px;
  padding-top: 5px;
`
const IssueTitle = styled(Text).attrs({
  size: 'large',
})`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${props => props.theme.surfaceContent};
  font-size: 1.2em;
  margin-right: 10px;
  /* stylelint-disable declaration-block-no-duplicate-properties, value-no-vendor-prefix, property-no-vendor-prefix */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

export default Issue
