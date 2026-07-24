import * as React from 'react';
import type { IRequisitionProps } from './IRequisitionProps';
import MainLayout from './MainLayout';
import 'font-awesome/css/font-awesome.min.css';
import { HashRouter as Router } from 'react-router-dom';

export default class Requisition extends React.Component<IRequisitionProps> {
  public render(): React.ReactElement<IRequisitionProps> {
    return (
      <Router>
        <MainLayout />
      </Router>
    );
  }
}
