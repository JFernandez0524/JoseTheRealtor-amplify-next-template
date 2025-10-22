import * as React from "react";
import { GridProps, TextAreaFieldProps, TextFieldProps } from "@aws-amplify/ui-react";
export declare type EscapeHatchProps = {
    [elementHierarchy: string]: Record<string, unknown>;
} | null;
export declare type VariantValues = {
    [key: string]: string;
};
export declare type Variant = {
    variantValues: VariantValues;
    overrides: EscapeHatchProps;
};
export declare type ValidationResponse = {
    hasError: boolean;
    errorMessage?: string;
};
export declare type ValidationFunction<T> = (value: T, validationResponse: ValidationResponse) => ValidationResponse | Promise<ValidationResponse>;
export declare type LeadCreateFormInputValues = {
    type?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    standardizedAddress?: string;
    executorFirstName?: string;
    executorLastName?: string;
    mailingAddress?: string;
    mailingCity?: string;
    mailingState?: string;
    mailingZip?: string;
    borrowerFirstName?: string;
    borrowerLastName?: string;
    caseNumber?: string;
    createdAt?: string;
};
export declare type LeadCreateFormValidationValues = {
    type?: ValidationFunction<string>;
    address?: ValidationFunction<string>;
    city?: ValidationFunction<string>;
    state?: ValidationFunction<string>;
    zip?: ValidationFunction<string>;
    standardizedAddress?: ValidationFunction<string>;
    executorFirstName?: ValidationFunction<string>;
    executorLastName?: ValidationFunction<string>;
    mailingAddress?: ValidationFunction<string>;
    mailingCity?: ValidationFunction<string>;
    mailingState?: ValidationFunction<string>;
    mailingZip?: ValidationFunction<string>;
    borrowerFirstName?: ValidationFunction<string>;
    borrowerLastName?: ValidationFunction<string>;
    caseNumber?: ValidationFunction<string>;
    createdAt?: ValidationFunction<string>;
};
export declare type PrimitiveOverrideProps<T> = Partial<T> & React.DOMAttributes<HTMLDivElement>;
export declare type LeadCreateFormOverridesProps = {
    LeadCreateFormGrid?: PrimitiveOverrideProps<GridProps>;
    type?: PrimitiveOverrideProps<TextFieldProps>;
    address?: PrimitiveOverrideProps<TextFieldProps>;
    city?: PrimitiveOverrideProps<TextFieldProps>;
    state?: PrimitiveOverrideProps<TextFieldProps>;
    zip?: PrimitiveOverrideProps<TextFieldProps>;
    standardizedAddress?: PrimitiveOverrideProps<TextAreaFieldProps>;
    executorFirstName?: PrimitiveOverrideProps<TextFieldProps>;
    executorLastName?: PrimitiveOverrideProps<TextFieldProps>;
    mailingAddress?: PrimitiveOverrideProps<TextFieldProps>;
    mailingCity?: PrimitiveOverrideProps<TextFieldProps>;
    mailingState?: PrimitiveOverrideProps<TextFieldProps>;
    mailingZip?: PrimitiveOverrideProps<TextFieldProps>;
    borrowerFirstName?: PrimitiveOverrideProps<TextFieldProps>;
    borrowerLastName?: PrimitiveOverrideProps<TextFieldProps>;
    caseNumber?: PrimitiveOverrideProps<TextFieldProps>;
    createdAt?: PrimitiveOverrideProps<TextFieldProps>;
} & EscapeHatchProps;
export declare type LeadCreateFormProps = React.PropsWithChildren<{
    overrides?: LeadCreateFormOverridesProps | undefined | null;
} & {
    clearOnSuccess?: boolean;
    onSubmit?: (fields: LeadCreateFormInputValues) => LeadCreateFormInputValues;
    onSuccess?: (fields: LeadCreateFormInputValues) => void;
    onError?: (fields: LeadCreateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: LeadCreateFormInputValues) => LeadCreateFormInputValues;
    onValidate?: LeadCreateFormValidationValues;
} & React.CSSProperties>;
export default function LeadCreateForm(props: LeadCreateFormProps): React.ReactElement;
