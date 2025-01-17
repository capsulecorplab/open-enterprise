import PropTypes from 'prop-types'
import React from 'react'
import styled from 'styled-components'

import { Checkbox, Text, TextInput, theme, SafeLink } from '@aragon/ui'

import { Form, FormField, DescriptionInput } from '../../Form'
import { IconGitHub } from '../../Shared'
import useGithubAuth from '../../../hooks/useGithubAuth'
import { useAragonApi } from '../../../api-react'
import { usePanelManagement } from '../../Panel'
import { ipfsAdd } from '../../../utils/ipfs-helpers'
import { issueShape } from '../../../utils/shapes.js'
import standardBounties from '../../../abi/StandardBounties.json'

class SubmitWork extends React.Component {
  static propTypes = {
    githubCurrentUser: PropTypes.object.isRequired,
    issue: issueShape,
    onSubmitWork: PropTypes.func.isRequired,
  }

  state = {
    proof: '',
    comments: '',
    hours: 0,
    ack1: false,
    ack2: false,
  }

  changeField = ({ target: { name, value } }) =>
    this.setState({ [name]: value })
  setAck1 = () => this.setState(prevState => ({ ack1: !prevState.ack1 }))
  setAck2 = () => this.setState(prevState => ({ ack2: !prevState.ack2 }))

  onSubmitWork = () => {
    let today = new Date()
    this.props.onSubmitWork(
      {
        user: this.props.githubCurrentUser,
        submissionDate: today.toISOString(),
        ...this.state,
      },
      this.props.issue
    )
  }

  canSubmit = () =>
    !(
      this.state.ack1 &&
      this.state.ack2 &&
      this.state.proof &&
      !isNaN(this.state.hours) &&
      this.state.hours > 0
    )

  render() {
    const { title, repo, number, url } = this.props.issue

    return (
      <Form
        onSubmit={this.onSubmitWork}
        submitText="Submit Work"
        noSeparator
        submitDisabled={this.canSubmit()}
      >
        <IssueTitle>{title}</IssueTitle>
        <SafeLink
          href={url}
          target="_blank"
          style={{ textDecoration: 'none', color: '#21AAE7' }}
        >
          <IssueLinkRow>
            <IconGitHub color="#21AAE7" width="14px" height="14px" />
            <Text style={{ marginLeft: '6px' }}>
              {repo} #{number}
            </Text>
          </IssueLinkRow>
        </SafeLink>

        <FormField
          label="Proof of Work"
          required
          input={
            <DescriptionInput
              name="proof"
              value={this.state.proof}
              rows="3"
              onChange={this.changeField}
              placeholder="Please link the Github Pull Request or an alternative proof of work if requested."
            />
          }
        />
        <FormField
          label="Additional Comments"
          input={
            <DescriptionInput
              name="comments"
              rows="5"
              value={this.state.comments}
              onChange={this.changeField}
              placeholder="Comments or details that haven’t already been described elsewhere."
            />
          }
        />

        <FormField
          label="Hours Worked"
          input={
            <TextInput.Number
              name="hours"
              value={this.state.hours}
              onChange={this.changeField}
            />
          }
        />
        <VSpace size={1} />
        <AckRow>
          <div style={{ width: '23px' }}>
            <Checkbox checked={this.state.ack1} onChange={this.setAck1} />
          </div>
          <AckText>
            I acknowledge that my work must be accepted for me to receive the
            payout.
          </AckText>
        </AckRow>

        <AckRow>
          <div style={{ width: '23px' }}>
            <Checkbox checked={this.state.ack2} onChange={this.setAck2} />
          </div>
          <AckText>
            I am reporting my hours honestly. I understand that this is for
            informational purposes only and it will be used to optimize pricing
            of future tasks.
          </AckText>
        </AckRow>
        <VSpace size={2} />

        { /* TODO: restore when GitHub commenting works
        <Info.Alert
          title="Submission note"
          background="#FFFAEE"
          style={{ marginBottom: '10px' }}
        >
          Your inputs will be added as a comment to the Github issue from your “
          {login}” account.
        </Info.Alert>
        */ }
      </Form>
    )
  }
}

// TODO: move entire component to functional component
// the following was a quick way to allow us to use hooks
const SubmitWorkWrap = props => {
  const githubCurrentUser = useGithubAuth()
  const { closePanel } = usePanelManagement()
  const { api, connectedAccount } = useAragonApi()

  const onSubmitWork = async (state, issue) => {
    closePanel()
    const hash = await ipfsAdd(state)

    const bountiesRegistry = await api.call('bountiesRegistry').toPromise()
    const bountyContract = api.external(bountiesRegistry, standardBounties.abi)
    bountyContract.fulfillBounty(
      connectedAccount, // address _sender,
      issue.standardBountyId, // uint _bountyId,
      [connectedAccount], // address payable [] memory  _fulfillers,
      hash // string memory _data
    ).toPromise()
  }

  return (
    <SubmitWork
      githubCurrentUser={githubCurrentUser}
      onSubmitWork={onSubmitWork}
      {...props}
    />
  )
}

const AckText = styled(Text)`
  color: ${theme.textSecondary};
  margin-left: 6px;
`
const AckRow = styled.div`
  display: flex;
  margin-bottom: 8px;
`
const IssueLinkRow = styled.div`
  height: 31px;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
`
const IssueTitle = styled(Text)`
  color: #717171;
  font-size: 17px;
  font-weight: 300;
  line-height: 1.5;
`

const VSpace = styled.div`
  height: ${p => (p.size || 1) * 5}px;
`

export default SubmitWorkWrap
