/* eslint-disable */
"use client";
import * as React from "react";
import {
  Button,
  Flex,
  Grid,
  TextAreaField,
  TextField,
} from "@aws-amplify/ui-react";
import { fetchByPath, getOverrideProps, validateField } from "./utils";
import { generateClient } from "aws-amplify/api";
import { getLead } from "./graphql/queries";
import { updateLead } from "./graphql/mutations";
const client = generateClient();
export default function LeadUpdateForm(props) {
  const {
    id: idProp,
    lead: leadModelProp,
    onSuccess,
    onError,
    onSubmit,
    onValidate,
    onChange,
    overrides,
    ...rest
  } = props;
  const initialValues = {
    type: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    standardizedAddress: "",
    executorFirstName: "",
    executorLastName: "",
    mailingAddress: "",
    mailingCity: "",
    mailingState: "",
    mailingZip: "",
    borrowerFirstName: "",
    borrowerLastName: "",
    caseNumber: "",
    createdAt: "",
  };
  const [type, setType] = React.useState(initialValues.type);
  const [address, setAddress] = React.useState(initialValues.address);
  const [city, setCity] = React.useState(initialValues.city);
  const [state, setState] = React.useState(initialValues.state);
  const [zip, setZip] = React.useState(initialValues.zip);
  const [standardizedAddress, setStandardizedAddress] = React.useState(
    initialValues.standardizedAddress
  );
  const [executorFirstName, setExecutorFirstName] = React.useState(
    initialValues.executorFirstName
  );
  const [executorLastName, setExecutorLastName] = React.useState(
    initialValues.executorLastName
  );
  const [mailingAddress, setMailingAddress] = React.useState(
    initialValues.mailingAddress
  );
  const [mailingCity, setMailingCity] = React.useState(
    initialValues.mailingCity
  );
  const [mailingState, setMailingState] = React.useState(
    initialValues.mailingState
  );
  const [mailingZip, setMailingZip] = React.useState(initialValues.mailingZip);
  const [borrowerFirstName, setBorrowerFirstName] = React.useState(
    initialValues.borrowerFirstName
  );
  const [borrowerLastName, setBorrowerLastName] = React.useState(
    initialValues.borrowerLastName
  );
  const [caseNumber, setCaseNumber] = React.useState(initialValues.caseNumber);
  const [createdAt, setCreatedAt] = React.useState(initialValues.createdAt);
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    const cleanValues = leadRecord
      ? { ...initialValues, ...leadRecord }
      : initialValues;
    setType(cleanValues.type);
    setAddress(cleanValues.address);
    setCity(cleanValues.city);
    setState(cleanValues.state);
    setZip(cleanValues.zip);
    setStandardizedAddress(
      typeof cleanValues.standardizedAddress === "string" ||
        cleanValues.standardizedAddress === null
        ? cleanValues.standardizedAddress
        : JSON.stringify(cleanValues.standardizedAddress)
    );
    setExecutorFirstName(cleanValues.executorFirstName);
    setExecutorLastName(cleanValues.executorLastName);
    setMailingAddress(cleanValues.mailingAddress);
    setMailingCity(cleanValues.mailingCity);
    setMailingState(cleanValues.mailingState);
    setMailingZip(cleanValues.mailingZip);
    setBorrowerFirstName(cleanValues.borrowerFirstName);
    setBorrowerLastName(cleanValues.borrowerLastName);
    setCaseNumber(cleanValues.caseNumber);
    setCreatedAt(cleanValues.createdAt);
    setErrors({});
  };
  const [leadRecord, setLeadRecord] = React.useState(leadModelProp);
  React.useEffect(() => {
    const queryData = async () => {
      const record = idProp
        ? (
            await client.graphql({
              query: getLead.replaceAll("__typename", ""),
              variables: { id: idProp },
            })
          )?.data?.getLead
        : leadModelProp;
      setLeadRecord(record);
    };
    queryData();
  }, [idProp, leadModelProp]);
  React.useEffect(resetStateValues, [leadRecord]);
  const validations = {
    type: [{ type: "Required" }],
    address: [{ type: "Required" }],
    city: [{ type: "Required" }],
    state: [{ type: "Required" }],
    zip: [{ type: "Required" }],
    standardizedAddress: [{ type: "JSON" }],
    executorFirstName: [],
    executorLastName: [],
    mailingAddress: [],
    mailingCity: [],
    mailingState: [],
    mailingZip: [],
    borrowerFirstName: [],
    borrowerLastName: [],
    caseNumber: [],
    createdAt: [],
  };
  const runValidationTasks = async (
    fieldName,
    currentValue,
    getDisplayValue
  ) => {
    const value =
      currentValue && getDisplayValue
        ? getDisplayValue(currentValue)
        : currentValue;
    let validationResponse = validateField(value, validations[fieldName]);
    const customValidator = fetchByPath(onValidate, fieldName);
    if (customValidator) {
      validationResponse = await customValidator(value, validationResponse);
    }
    setErrors((errors) => ({ ...errors, [fieldName]: validationResponse }));
    return validationResponse;
  };
  const convertToLocal = (date) => {
    const df = new Intl.DateTimeFormat("default", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      calendar: "iso8601",
      numberingSystem: "latn",
      hourCycle: "h23",
    });
    const parts = df.formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  return (
    <Grid
      as="form"
      rowGap="15px"
      columnGap="15px"
      padding="20px"
      onSubmit={async (event) => {
        event.preventDefault();
        let modelFields = {
          type,
          address,
          city,
          state,
          zip,
          standardizedAddress: standardizedAddress ?? null,
          executorFirstName: executorFirstName ?? null,
          executorLastName: executorLastName ?? null,
          mailingAddress: mailingAddress ?? null,
          mailingCity: mailingCity ?? null,
          mailingState: mailingState ?? null,
          mailingZip: mailingZip ?? null,
          borrowerFirstName: borrowerFirstName ?? null,
          borrowerLastName: borrowerLastName ?? null,
          caseNumber: caseNumber ?? null,
          createdAt: createdAt ?? null,
        };
        const validationResponses = await Promise.all(
          Object.keys(validations).reduce((promises, fieldName) => {
            if (Array.isArray(modelFields[fieldName])) {
              promises.push(
                ...modelFields[fieldName].map((item) =>
                  runValidationTasks(fieldName, item)
                )
              );
              return promises;
            }
            promises.push(
              runValidationTasks(fieldName, modelFields[fieldName])
            );
            return promises;
          }, [])
        );
        if (validationResponses.some((r) => r.hasError)) {
          return;
        }
        if (onSubmit) {
          modelFields = onSubmit(modelFields);
        }
        try {
          Object.entries(modelFields).forEach(([key, value]) => {
            if (typeof value === "string" && value === "") {
              modelFields[key] = null;
            }
          });
          await client.graphql({
            query: updateLead.replaceAll("__typename", ""),
            variables: {
              input: {
                id: leadRecord.id,
                ...modelFields,
              },
            },
          });
          if (onSuccess) {
            onSuccess(modelFields);
          }
        } catch (err) {
          if (onError) {
            const messages = err.errors.map((e) => e.message).join("\n");
            onError(modelFields, messages);
          }
        }
      }}
      {...getOverrideProps(overrides, "LeadUpdateForm")}
      {...rest}
    >
      <TextField
        label="Type"
        isRequired={true}
        isReadOnly={false}
        value={type}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type: value,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.type ?? value;
          }
          if (errors.type?.hasError) {
            runValidationTasks("type", value);
          }
          setType(value);
        }}
        onBlur={() => runValidationTasks("type", type)}
        errorMessage={errors.type?.errorMessage}
        hasError={errors.type?.hasError}
        {...getOverrideProps(overrides, "type")}
      ></TextField>
      <TextField
        label="Address"
        isRequired={true}
        isReadOnly={false}
        value={address}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address: value,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.address ?? value;
          }
          if (errors.address?.hasError) {
            runValidationTasks("address", value);
          }
          setAddress(value);
        }}
        onBlur={() => runValidationTasks("address", address)}
        errorMessage={errors.address?.errorMessage}
        hasError={errors.address?.hasError}
        {...getOverrideProps(overrides, "address")}
      ></TextField>
      <TextField
        label="City"
        isRequired={true}
        isReadOnly={false}
        value={city}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city: value,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.city ?? value;
          }
          if (errors.city?.hasError) {
            runValidationTasks("city", value);
          }
          setCity(value);
        }}
        onBlur={() => runValidationTasks("city", city)}
        errorMessage={errors.city?.errorMessage}
        hasError={errors.city?.hasError}
        {...getOverrideProps(overrides, "city")}
      ></TextField>
      <TextField
        label="State"
        isRequired={true}
        isReadOnly={false}
        value={state}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state: value,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.state ?? value;
          }
          if (errors.state?.hasError) {
            runValidationTasks("state", value);
          }
          setState(value);
        }}
        onBlur={() => runValidationTasks("state", state)}
        errorMessage={errors.state?.errorMessage}
        hasError={errors.state?.hasError}
        {...getOverrideProps(overrides, "state")}
      ></TextField>
      <TextField
        label="Zip"
        isRequired={true}
        isReadOnly={false}
        value={zip}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip: value,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.zip ?? value;
          }
          if (errors.zip?.hasError) {
            runValidationTasks("zip", value);
          }
          setZip(value);
        }}
        onBlur={() => runValidationTasks("zip", zip)}
        errorMessage={errors.zip?.errorMessage}
        hasError={errors.zip?.hasError}
        {...getOverrideProps(overrides, "zip")}
      ></TextField>
      <TextAreaField
        label="Standardized address"
        isRequired={false}
        isReadOnly={false}
        value={standardizedAddress}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress: value,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.standardizedAddress ?? value;
          }
          if (errors.standardizedAddress?.hasError) {
            runValidationTasks("standardizedAddress", value);
          }
          setStandardizedAddress(value);
        }}
        onBlur={() =>
          runValidationTasks("standardizedAddress", standardizedAddress)
        }
        errorMessage={errors.standardizedAddress?.errorMessage}
        hasError={errors.standardizedAddress?.hasError}
        {...getOverrideProps(overrides, "standardizedAddress")}
      ></TextAreaField>
      <TextField
        label="Executor first name"
        isRequired={false}
        isReadOnly={false}
        value={executorFirstName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName: value,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.executorFirstName ?? value;
          }
          if (errors.executorFirstName?.hasError) {
            runValidationTasks("executorFirstName", value);
          }
          setExecutorFirstName(value);
        }}
        onBlur={() =>
          runValidationTasks("executorFirstName", executorFirstName)
        }
        errorMessage={errors.executorFirstName?.errorMessage}
        hasError={errors.executorFirstName?.hasError}
        {...getOverrideProps(overrides, "executorFirstName")}
      ></TextField>
      <TextField
        label="Executor last name"
        isRequired={false}
        isReadOnly={false}
        value={executorLastName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName: value,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.executorLastName ?? value;
          }
          if (errors.executorLastName?.hasError) {
            runValidationTasks("executorLastName", value);
          }
          setExecutorLastName(value);
        }}
        onBlur={() => runValidationTasks("executorLastName", executorLastName)}
        errorMessage={errors.executorLastName?.errorMessage}
        hasError={errors.executorLastName?.hasError}
        {...getOverrideProps(overrides, "executorLastName")}
      ></TextField>
      <TextField
        label="Mailing address"
        isRequired={false}
        isReadOnly={false}
        value={mailingAddress}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress: value,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.mailingAddress ?? value;
          }
          if (errors.mailingAddress?.hasError) {
            runValidationTasks("mailingAddress", value);
          }
          setMailingAddress(value);
        }}
        onBlur={() => runValidationTasks("mailingAddress", mailingAddress)}
        errorMessage={errors.mailingAddress?.errorMessage}
        hasError={errors.mailingAddress?.hasError}
        {...getOverrideProps(overrides, "mailingAddress")}
      ></TextField>
      <TextField
        label="Mailing city"
        isRequired={false}
        isReadOnly={false}
        value={mailingCity}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity: value,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.mailingCity ?? value;
          }
          if (errors.mailingCity?.hasError) {
            runValidationTasks("mailingCity", value);
          }
          setMailingCity(value);
        }}
        onBlur={() => runValidationTasks("mailingCity", mailingCity)}
        errorMessage={errors.mailingCity?.errorMessage}
        hasError={errors.mailingCity?.hasError}
        {...getOverrideProps(overrides, "mailingCity")}
      ></TextField>
      <TextField
        label="Mailing state"
        isRequired={false}
        isReadOnly={false}
        value={mailingState}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState: value,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.mailingState ?? value;
          }
          if (errors.mailingState?.hasError) {
            runValidationTasks("mailingState", value);
          }
          setMailingState(value);
        }}
        onBlur={() => runValidationTasks("mailingState", mailingState)}
        errorMessage={errors.mailingState?.errorMessage}
        hasError={errors.mailingState?.hasError}
        {...getOverrideProps(overrides, "mailingState")}
      ></TextField>
      <TextField
        label="Mailing zip"
        isRequired={false}
        isReadOnly={false}
        value={mailingZip}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip: value,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.mailingZip ?? value;
          }
          if (errors.mailingZip?.hasError) {
            runValidationTasks("mailingZip", value);
          }
          setMailingZip(value);
        }}
        onBlur={() => runValidationTasks("mailingZip", mailingZip)}
        errorMessage={errors.mailingZip?.errorMessage}
        hasError={errors.mailingZip?.hasError}
        {...getOverrideProps(overrides, "mailingZip")}
      ></TextField>
      <TextField
        label="Borrower first name"
        isRequired={false}
        isReadOnly={false}
        value={borrowerFirstName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName: value,
              borrowerLastName,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.borrowerFirstName ?? value;
          }
          if (errors.borrowerFirstName?.hasError) {
            runValidationTasks("borrowerFirstName", value);
          }
          setBorrowerFirstName(value);
        }}
        onBlur={() =>
          runValidationTasks("borrowerFirstName", borrowerFirstName)
        }
        errorMessage={errors.borrowerFirstName?.errorMessage}
        hasError={errors.borrowerFirstName?.hasError}
        {...getOverrideProps(overrides, "borrowerFirstName")}
      ></TextField>
      <TextField
        label="Borrower last name"
        isRequired={false}
        isReadOnly={false}
        value={borrowerLastName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName: value,
              caseNumber,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.borrowerLastName ?? value;
          }
          if (errors.borrowerLastName?.hasError) {
            runValidationTasks("borrowerLastName", value);
          }
          setBorrowerLastName(value);
        }}
        onBlur={() => runValidationTasks("borrowerLastName", borrowerLastName)}
        errorMessage={errors.borrowerLastName?.errorMessage}
        hasError={errors.borrowerLastName?.hasError}
        {...getOverrideProps(overrides, "borrowerLastName")}
      ></TextField>
      <TextField
        label="Case number"
        isRequired={false}
        isReadOnly={false}
        value={caseNumber}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber: value,
              createdAt,
            };
            const result = onChange(modelFields);
            value = result?.caseNumber ?? value;
          }
          if (errors.caseNumber?.hasError) {
            runValidationTasks("caseNumber", value);
          }
          setCaseNumber(value);
        }}
        onBlur={() => runValidationTasks("caseNumber", caseNumber)}
        errorMessage={errors.caseNumber?.errorMessage}
        hasError={errors.caseNumber?.hasError}
        {...getOverrideProps(overrides, "caseNumber")}
      ></TextField>
      <TextField
        label="Created at"
        isRequired={false}
        isReadOnly={false}
        type="datetime-local"
        value={createdAt && convertToLocal(new Date(createdAt))}
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              type,
              address,
              city,
              state,
              zip,
              standardizedAddress,
              executorFirstName,
              executorLastName,
              mailingAddress,
              mailingCity,
              mailingState,
              mailingZip,
              borrowerFirstName,
              borrowerLastName,
              caseNumber,
              createdAt: value,
            };
            const result = onChange(modelFields);
            value = result?.createdAt ?? value;
          }
          if (errors.createdAt?.hasError) {
            runValidationTasks("createdAt", value);
          }
          setCreatedAt(value);
        }}
        onBlur={() => runValidationTasks("createdAt", createdAt)}
        errorMessage={errors.createdAt?.errorMessage}
        hasError={errors.createdAt?.hasError}
        {...getOverrideProps(overrides, "createdAt")}
      ></TextField>
      <Flex
        justifyContent="space-between"
        {...getOverrideProps(overrides, "CTAFlex")}
      >
        <Button
          children="Reset"
          type="reset"
          onClick={(event) => {
            event.preventDefault();
            resetStateValues();
          }}
          isDisabled={!(idProp || leadModelProp)}
          {...getOverrideProps(overrides, "ResetButton")}
        ></Button>
        <Flex
          gap="15px"
          {...getOverrideProps(overrides, "RightAlignCTASubFlex")}
        >
          <Button
            children="Submit"
            type="submit"
            variation="primary"
            isDisabled={
              !(idProp || leadModelProp) ||
              Object.values(errors).some((e) => e?.hasError)
            }
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
