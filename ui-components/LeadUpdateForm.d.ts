import * as React from "react";
import { GridProps, TextAreaFieldProps, TextFieldProps } from "@aws-amplify/ui-react";
import { Lead } from "./graphql/types";
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
export declare type LeadUpdateFormInputValues = {
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
export declare type LeadUpdateFormValidationValues = {
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
export declare type LeadUpdateFormOverridesProps = {
    LeadUpdateFormGrid?: PrimitiveOverrideProps<GridProps>;
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
export declare type LeadUpdateFormProps = React.PropsWithChildren<{
    overrides?: LeadUpdateFormOverridesProps | undefined | null;
} & {
    id?: string;
    lead?: Lead;
    onSubmit?: (fields: LeadUpdateFormInputValues) => LeadUpdateFormInputValues;
    onSuccess?: (fields: LeadUpdateFormInputValues) => void;
    onError?: (fields: LeadUpdateFormInputValues, errorMessage: string) => void;
    onChange?: (fields: LeadUpdateFormInputValues) => LeadUpdateFormInputValues;
    onValidate?: LeadUpdateFormValidationValues;
} & React.CSSProperties>;
export default function LeadUpdateForm(props: LeadUpdateFormProps): React.ReactElement;
