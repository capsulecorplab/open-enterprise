import PropTypes from 'prop-types'
import React from 'react'
import { Info } from '@aragon/ui'
import web3Utils from 'web3-utils'
import { OptionsInput } from '../../../../../shared/ui'
import { BigNumber } from 'bignumber.js'

import {
  DescriptionInput,
  Form,
  FormField,
  InputDropDown,
} from '../Form'

const INITIAL_STATE = {
  activePayoutOption: 0,
  addressError: false,
  allocationDescription: '',
  allocationError: false,
  allocationType: '',
  allocationTypeIndex: 1,
  amount: null,
  payoutToken: '',
  payoutTokenIndex: 0,
  payoutType: '',
  payoutTypeIndex: 0,
  userInput: { addr: '' },
  userInputCandidates: [],
  votingTokens: null,
}

const message = {
  addressError: 'All options must be addresses and cannot be duplicates.',
  descriptionError: 'A description of the allocation is required.',
  allocationError: 'Amount must be set.',
  transferWarning:
    'This will create a Dot Vote and after it closes, it will result in a financial transfer.',
  tokenTransferWarning:
    'Since you are proposing an allocation with tokens, it will be withdrawn from the Vault if approved, since Accounts do not hold tokens. Vault Balance: ' ,
  ethBalanceError: 'Amount is greater than ETH balance held by Account',
  tokenBalanceError: 'Amount is greater than token balance held by Vault',
}

const uniqueAddressValidation = (entries, addr) => {
  const isAddress = web3Utils.isAddress(addr)
  const isUnique = !entries.length || !entries.map(e => e.addr).includes(addr)
  const notEmpty = addr && !!addr.length && addr !== '0x0'
  const validated = isAddress && isUnique && notEmpty
  return validated // approved if not errorCondition
}

class NewAllocation extends React.Component {
  static propTypes = {
    onSubmitAllocation: PropTypes.func.isRequired,
    description: PropTypes.string,
    balances: PropTypes.arrayOf(PropTypes.object).isRequired,
    // TODO: Fix balance, should be required (is not arriving)
    balance: PropTypes.string,
    id: PropTypes.string.isRequired,
    subHeading: PropTypes.string,
  }

  state = {
    ...INITIAL_STATE,
    tokenAddress: this.props.balances[0].address,
  }

  // TODO: improve field checking for input errors and sanitize
  changeField = ({ target: { name, value } }) => {
    // reset error to false if changing related field
    const resetAddressError = [
      'userInput',
      'userInputCandidates',
    ].includes(name)
    const resetAllocationsError = name === 'amount'
    const resetDescriptionError = name === 'allocationDescription'

    // react chains the state changes asynchronously
    resetAddressError && this.setState({ addressError: false })
    resetAllocationsError && this.setState({ allocationError: false, ethBalanceError: false, tokenBalanceError: false })
    resetDescriptionError && this.setState({ descriptionError: false })

    this.setState({ [name]: value })
  }

  // TODO: Manage dropdown to return a name and value as the rest of inputs

  changePayoutToken = items => index => {
    this.setState({
      allocationError: false,
      payoutTokenIndex: index,
      payoutToken: items[index],
      tokenAddress: this.props.balances[index].address
    })
  }

  submitAllocation = () => {
    const { props, state } = this
    const token  = props.balances[state.payoutTokenIndex]
    const { userInput, userInputCandidates } = state
    const informational = state.allocationTypeIndex === 0
    const recurring = state.payoutTypeIndex !== 0
    const candidates = uniqueAddressValidation(userInputCandidates, userInput.addr) ?
      [ userInput, ...userInputCandidates ] : userInputCandidates
    const allocation = {
      budgetId: this.props.id,
      informational: informational,
      recurring: recurring,
      period: recurring ? 86400 * 31 : 0,
      balance: this.state.amount * 10e17,
      description: this.state.allocationDescription,
      tokenAddress: this.state.tokenAddress,
    }

    if (state.addressError || state.allocationError || state.descriptionError) {
      return
    }
    if(allocation.description === ''){
      this.setState({ descriptionError: true })
      return
    }
    if (!informational && allocation.balance === 0) {
      this.setState({ allocationError: true })
      return
    }
    if(state.payoutTokenIndex === 0 && state.amount * 10e17 > props.balance) {
      this.setState({ ethBalanceError: true })
      return
    }
    if(state.payoutTokenIndex !== 0 && state.amount * 10**token.decimals > token.amount) {
      this.setState({ tokenBalanceError: true })
      return
    }
    if (!candidates.length) {
      this.setState({ addressError: true })
      return
    }

    // If everything is ok (no validation error) add candidates to allocation.addresses
    allocation.addresses = candidates.map(c => c.addr)
    props.onSubmitAllocation(allocation)
    this.setState(INITIAL_STATE)
  }
  WarningMessage = (hasWarning, type ) =>{
    if(hasWarning){
      let specificMessage = message[type]
      if(type === 'tokenTransferWarning'){
        let token = this.props.balances[this.state.payoutTokenIndex]
        let tokenDisplay = BigNumber(token.amount)
          .div(
            BigNumber(10).pow(token.decimals)
          ).dp(3)
        specificMessage = specificMessage + tokenDisplay
      }
      return (
        <Info.Action title="Warning" style={{ marginBottom: '10px' }}>
          {specificMessage}
        </Info.Action>
      )
    }
    return null
  }

  render() {
    const { props, state } = this
    const transferEnabled = state.allocationTypeIndex === 1
    let availableTokens =  this.props.balances.map( balance => balance.symbol)

    const amountInput = {
      name: 'amount',
      value: state.amount || '',
      onChange: this.changeField,
      type: 'number',
      min: '0',
    }

    const amountDropDown = {
      name: 'token',
      items: availableTokens,
      selected: state.payoutTokenIndex,
      onChange: this.changePayoutToken(availableTokens),
    }

    const amountWarningMessages = (
      this.WarningMessage(state.payoutTokenIndex !== 0, 'tokenTransferWarning')
    )

    const errorMessages = [ 'allocationError', 'addressError', 'descriptionError', 'ethBalanceError', 'tokenBalanceError' ].map((e, i) => (
      <div key={i}>
        <ErrorMessage hasError={state[e]} type={e} />
      </div>
    ))

    const descriptionField = (
      <FormField
        visible={true}
        required
        label="Description"
        input={
          <DescriptionInput
            name="allocationDescription"
            onChange={this.changeField}
            placeholder="Describe your allocation."
            value={state.allocationDescription}
          />
        }
      />
    )

    const amountField = (
      <FormField
        visible={transferEnabled}
        required
        separator
        label="Amount"
        // TODO: We should back to width: '375px' when RecurringDropDown is used again
        input={
          <div style={{ display: 'flex', width: '220px' }}>
            <InputDropDown
              wide
              textInput={amountInput}
              dropDown={amountDropDown}
            />
            {/* // Not currently implemented: */}
            {/* <RecurringDropDown
            dropDown={{
              name: 'payoutType',
              items: PAYOUT_TYPES,
              active: this.payoutTypeIndex,
              onChange: this.changePayoutType,
            }}
          /> */}
          </div>
        }
      />
    )


    const userOptionsField = (
      <FormField
        label="Options"
        required
        separator
        input={
          <OptionsInput
            error={state.addressError}
            input={state.userInput}
            name="userInputCandidates"
            onChange={this.changeField}
            placeholder="Enter an address option"
            validator={uniqueAddressValidation}
            values={state.userInputCandidates}
          />
        }
      />
    )

    return (
      <div>
        <Form
          subHeading={props.subHeading}
          onSubmit={this.submitAllocation}
          description={props.description}
          submitText="Submit Allocation"
        >
          {descriptionField}
          {amountField}
          {amountWarningMessages}
          {userOptionsField}
          {errorMessages}
        </Form>
      </div>
    )
  }
}

const ErrorMessage = ({ hasError, type }) =>
  hasError ? (
    <Info
      background="#fb79790f"
      title="Error"
      style={{ margin: '20px 0' }}
    >
      {message[type]}
    </Info>
  ) : null

ErrorMessage.propTypes = {
  hasError: PropTypes.bool,
  type: PropTypes.string,
}

// eslint-disable-next-line import/no-unused-modules
export default NewAllocation
