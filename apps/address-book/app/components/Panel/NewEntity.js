import React from 'react'
import PropTypes from 'prop-types'
import { Form, FormField } from '../Form'
import { DropDown, IconClose, TextInput, theme } from '@aragon/ui'
import styled from 'styled-components'
import web3Utils from 'web3-utils'

const isCustomType = type => type === 'Custom type...'

const ENTITY_TYPES = [ 'Individual', 'Organization', 'Project', 'Custom type...' ]
const INITIAL_STATE = {
  name: '',
  address: '',
  type: 'Individual',
  customType: ''
}

const ErrorText = styled.div`
  font-size: small;
  display: flex;
  align-items: center;
  margin-top: 24px;
`

const ErrorMessage = ({ children }) => (
  <ErrorText>
    <IconClose
      size="tiny"
      css={{
        marginRight: '8px',
        color: theme.negative,
      }}
    />
    {children}
  </ErrorText>
)

ErrorMessage.propTypes = {
  children: PropTypes.node,
}

class NewEntity extends React.Component {
  static propTypes = {
    onCreateEntity: PropTypes.func.isRequired,
    addressList: PropTypes.arrayOf(PropTypes.string).isRequired,
  }

  state = INITIAL_STATE

  changeField = ({ target: { name, value } }) => {
    this.setState({
      [name]: value,
    })
  }

  changeType = type => {
    this.setState({
      type: ENTITY_TYPES[type],
    })
  }

  handleSubmit = () => {
    const { name, address, type, customType } = this.state
    const data = {
      name: name,
      address: address,
      type: isCustomType(type) ? customType : type,
    }

    this.setState(INITIAL_STATE)
    this.props.onCreateEntity(data)
  }

  render() {
    const { address, name, type, customType } = this.state
    const { handleSubmit, changeField, changeType } = this

    const emptyName = name.trim() === ''
    const emptyAddress = address.trim() === ''
    const emptyCustomType = customType.trim() === ''

    const errorAddress = !emptyAddress && !web3Utils.isAddress(address)
      ? <ErrorMessage>Please provide a valid ethereum address</ErrorMessage>
      : null

    const formDisabled = emptyName || emptyAddress || (isCustomType(type) && emptyCustomType) || errorAddress

    const customTypeFormField =
      type === 'Custom type...' ? (
        <FormField
          required
          label="Custom type"
          input={
            <TextInput
              name="customType"
              onChange={changeField}
              value={customType}
              wide
            />
          }
        />
      ) : null

    return (
      <Form
        onSubmit={handleSubmit}
        disabled={!!formDisabled}
        submitText="Submit Entity"
        error={errorAddress}
      >
        <FormField
          required
          label="Name"
          input={
            <TextInput name="name" onChange={changeField} value={name} wide />
          }
        />

        <FormField
          required
          label="Address"
          input={
            <TextInput
              name="address"
              onChange={changeField}
              value={address}
              wide
            />
          }
        />

        <FormField
          label="Type"
          input={
            <DropDown
              name="type"
              items={ENTITY_TYPES}
              onChange={changeType}
              selected={ENTITY_TYPES.indexOf(type)}
              wide
            />
          }
        />

        {customTypeFormField}
      </Form>
    )
  }
}

export default NewEntity
