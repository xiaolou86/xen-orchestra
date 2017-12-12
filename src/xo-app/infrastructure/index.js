import _ from 'intl'
import Icon from 'icon'
import Page from '../page'
import React from 'react'
import { routes } from 'utils'
import { Container, Row, Col } from 'grid'
import { NavLink, NavTabs } from 'nav'

import Health from './health'
import Dashboard from './dashboard'
import Stats from './stats'
import Tree from './tree'
import Visualizations from './visualizations'

const HEADER = (
  <Container>
    <Row>
      <Col mediumSize={3}>
        <h2>
<<<<<<< Updated upstream
          <Icon icon='menu-infrastructure' /> {_('infraPage')}
        </h2>
      </Col>
      <Col mediumSize={9}>
        <NavTabs className='pull-right'>
          <NavLink to={'/infrastructure/dashboard'}>
            <Icon icon='menu-infrastructure-dashboard' /> {_('dashboardPage')}
          </NavLink>
          <NavLink to={'/infrastructure/tree'}>
            <Icon icon='menu-infrastructure-tree' /> {_('treePage')}
          </NavLink>
          <NavLink to={'/infrastructure/visualizations'}>
            <Icon icon='menu-infrastructure-visualization' />{' '}
            {_('overviewVisualizationDashboardPage')}
          </NavLink>
          <NavLink to={'/infrastructure/stats'}>
            <Icon icon='menu-infrastructure-stats' />{' '}
            {_('overviewStatsDashboardPage')}
          </NavLink>
          <NavLink to={'/infrastructure/health'}>
            <Icon icon='menu-infrastructure-health' />{' '}
=======
          <Icon icon="menu-infrastructure" /> {_('infraPage')}
        </h2>
      </Col>
      <Col mediumSize={9}>
        <NavTabs className="pull-right">
          <NavLink to={'/infrastructure/dashboard'}>
            <Icon icon="menu-infrastructure-dashboard" /> {_('dashboardPage')}
          </NavLink>
          <NavLink to={'/infrastructure/tree'}>
            <Icon icon="menu-infrastructure-tree" /> {_('treePage')}
          </NavLink>
          <NavLink to={'/infrastructure/visualizations'}>
            <Icon icon="menu-infrastructure-visualization" />{' '}
            {_('overviewVisualizationDashboardPage')}
          </NavLink>
          <NavLink to={'/infrastructure/stats'}>
            <Icon icon="menu-infrastructure-stats" />{' '}
            {_('overviewStatsDashboardPage')}
          </NavLink>
          <NavLink to={'/infrastructure/health'}>
            <Icon icon="menu-infrastructure-health" />{' '}
>>>>>>> Stashed changes
            {_('overviewHealthDashboardPage')}
          </NavLink>
        </NavTabs>
      </Col>
    </Row>
  </Container>
)

const Infrastructure = routes('infrastructure', {
  health: Health,
  dashboard: Dashboard,
  stats: Stats,
  tree: Tree,
<<<<<<< Updated upstream
  visualizations: Visualizations,
})(({ children }) => (
  <Page header={HEADER} title='infraPage' formatTitle>
=======
  visualizations: Visualizations
})(({ children }) => (
  <Page header={HEADER} title="infraPage" formatTitle>
>>>>>>> Stashed changes
    {children}
  </Page>
))

export default Infrastructure
