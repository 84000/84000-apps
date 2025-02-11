import React from "react";
import type { Metadata } from "next";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import RoundedInputs from "../../../components/form-components/Form-Elements/RoundedInputs";
import SquareInputs from "../../../components/form-components/Form-Elements/SquareInputs";
import DefaultForm from "../../../components/form-components/Form-Elements/DefaultForm";
import InputSizing from "../../../components/form-components/Form-Elements/InputSizing";
import DisableInputs from "../../../components/form-components/Form-Elements/DisableInputs";
import InputShadow from "../../../components/form-components/Form-Elements/InputShadow";
import InputWithIcon from "../../../components/form-components/Form-Elements/InputWithIcon";
import RangeSliders from "../../../components/form-components/Form-Elements/RangeSlider";
import FormValidation from "../../../components/form-components/Form-Elements/FormValidation";
import TextAreaEle from "../../../components/form-components/Form-Elements/TextArea";
import ToggelSwitches from "../../../components/form-components/Form-Elements/ToggelSwitches";
import CheckBoxes from "../../../components/form-components/Form-Elements/CheckBoxes";
import RadioButtons from "../../../components/form-components/Form-Elements/RadioButtons";
import FileUploadEle from "../../../components/form-components/Form-Elements/FileUploadEle";
import FileUploadSizings from "../../../components/form-components/Form-Elements/FileUploadSizings";
import DropZone from "../../../components/form-components/Form-Elements/DropZone";
import SelectInput from "../../../components/form-components/Form-Elements/SelectInput";
import FormHelperText from "../../../components/form-components/Form-Elements/FormHelperText";
import InputColors from "../../../components/form-components/Form-Elements/InputColors";

export const metadata: Metadata = {
  title: "Form Elements",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Form Elements",
  },
];

const page = () => {
  return (
    <>
      <BreadcrumbComp title="Form Elements" items={BCrumb} />
      <div className="grid grid-cols-12 gap-30">
        <div className="lg:col-span-6 col-span-12">
          <RoundedInputs />
        </div>
        <div className="lg:col-span-6 col-span-12">
          <SquareInputs />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <DefaultForm />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <InputSizing />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <DisableInputs />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <InputShadow />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <InputWithIcon />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <RangeSliders />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <FormValidation />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <TextAreaEle />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <ToggelSwitches />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <CheckBoxes />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <RadioButtons />
        </div>
        <div className="lg:col-span-4 col-span-12">
          <FileUploadEle />
        </div>
        <div className="md:col-span-6 col-span-12">
          <FileUploadSizings />
        </div>
        <div className="md:col-span-6 col-span-12">
          <DropZone />
        </div>
        <div className="md:col-span-6 col-span-12">
          <SelectInput />
        </div>
        <div className="md:col-span-6 col-span-12">
          <FormHelperText />
        </div>
        <div className="col-span-12">
          <InputColors />
        </div>
      </div>
    </>
  );
};

export default page;
