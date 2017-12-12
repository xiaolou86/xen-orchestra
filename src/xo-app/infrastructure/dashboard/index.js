import _ from 'intl'
import ButtonGroup from 'button-group'
import ChartistGraph from 'react-chartist'
import Component from 'base-component'
import forEach from 'lodash/forEach'
import Icon from 'icon'
import propTypes from 'prop-types-decorator'
import Link, { BlockLink } from 'link'
import map from 'lodash/map'
import HostsPatchesTable from 'hosts-patches-table'
import React from 'react'
import size from 'lodash/size'
import Upgrade from 'xoa-upgrade'
import { Card, CardBlock, CardHeader } from 'card'
import { Container, Row, Col } from 'grid'
import {
  createCollectionWrapper,
  createCounter,
  createGetObjectsOfType,
  createGetHostMetrics,
  createSelector,
  createTop,
<<<<<<< Updated upstream
  isAdmin,
=======
  isAdmin
>>>>>>> Stashed changes
} from 'selectors'
import { connectStore, formatSize } from 'utils'
import { isSrWritable, subscribeUsers } from 'xo'

import styles from './index.css'

// ===================================================================

@propTypes({
<<<<<<< Updated upstream
  hosts: propTypes.object.isRequired,
=======
  hosts: propTypes.object.isRequired
>>>>>>> Stashed changes
})
class PatchesCard extends Component {
  _getContainer = () => this.refs.container

<<<<<<< Updated upstream
  render () {
    return (
      <Card>
        <CardHeader>
          <Icon icon='host-patch-update' /> {_('update')}
          <div ref='container' className='pull-right' />
=======
  render() {
    return (
      <Card>
        <CardHeader>
          <Icon icon="host-patch-update" /> {_('update')}
          <div ref="container" className="pull-right" />
>>>>>>> Stashed changes
        </CardHeader>
        <CardBlock>
          <HostsPatchesTable
            buttonsGroupContainer={this._getContainer}
            container={ButtonGroup}
            displayPools
            hosts={this.props.hosts}
          />
        </CardBlock>
      </Card>
    )
  }
}

// ===================================================================

@connectStore(() => {
  const getHosts = createGetObjectsOfType('host')
  const getVms = createGetObjectsOfType('VM')

  const getHostMetrics = createGetHostMetrics(getHosts)

  const writableSrs = createGetObjectsOfType('SR').filter([isSrWritable])

  const getSrMetrics = createCollectionWrapper(
    createSelector(writableSrs, writableSrs => {
      const metrics = {
        srTotal: 0,
<<<<<<< Updated upstream
        srUsage: 0,
=======
        srUsage: 0
>>>>>>> Stashed changes
      }
      forEach(writableSrs, sr => {
        metrics.srUsage += sr.physical_usage
        metrics.srTotal += sr.size
      })
      return metrics
    })
  )
  const getVmMetrics = createCollectionWrapper(
    createSelector(getVms, vms => {
      const metrics = {
        vcpus: 0,
        running: 0,
        halted: 0,
<<<<<<< Updated upstream
        other: 0,
=======
        other: 0
>>>>>>> Stashed changes
      }
      forEach(vms, vm => {
        if (vm.power_state === 'Running') {
          metrics.running++
          metrics.vcpus += vm.CPUs.number
        } else if (vm.power_state === 'Halted') {
          metrics.halted++
        } else metrics.other++
      })
      return metrics
    })
  )
  const getNumberOfAlarmMessages = createCounter(
    createGetObjectsOfType('message'),
    [message => message.name === 'ALARM']
  )
  const getNumberOfHosts = createCounter(getHosts)
  const getNumberOfPools = createCounter(createGetObjectsOfType('pool'))
  const getNumberOfTasks = createCounter(
    createGetObjectsOfType('task').filter([task => task.status === 'pending'])
  )
  const getNumberOfVms = createCounter(getVms)

  return {
    hostMetrics: getHostMetrics,
    hosts: getHosts,
    isAdmin,
    nAlarmMessages: getNumberOfAlarmMessages,
    nHosts: getNumberOfHosts,
    nPools: getNumberOfPools,
    nTasks: getNumberOfTasks,
    nVms: getNumberOfVms,
    srMetrics: getSrMetrics,
    topWritableSrs: createTop(
      writableSrs,
      [sr => sr.physical_usage / sr.size],
      5
    ),
<<<<<<< Updated upstream
    vmMetrics: getVmMetrics,
  }
})
export default class Dashboard extends Component {
  componentWillMount () {
=======
    vmMetrics: getVmMetrics
  }
})
export default class Dashboard extends Component {
  componentWillMount() {
>>>>>>> Stashed changes
    this.componentWillUnmount = subscribeUsers(users => {
      this.setState({ users })
    })
  }
<<<<<<< Updated upstream
  render () {
=======
  render() {
>>>>>>> Stashed changes
    const { props, state } = this
    const users = state && state.users
    const nUsers = size(users)

    return process.env.XOA_PLAN > 2 ? (
      <Container>
        <Row>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='pool' /> {_('poolPanel', { pools: props.nPools })}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to='/home?t=pool'>{props.nPools}</Link>
=======
                <Icon icon="pool" /> {_('poolPanel', { pools: props.nPools })}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to="/home?t=pool">{props.nPools}</Link>
>>>>>>> Stashed changes
                </p>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='host' /> {_('hostPanel', { hosts: props.nHosts })}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to='/home?t=host'>{props.nHosts}</Link>
=======
                <Icon icon="host" /> {_('hostPanel', { hosts: props.nHosts })}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to="/home?t=host">{props.nHosts}</Link>
>>>>>>> Stashed changes
                </p>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='vm' /> {_('vmPanel', { vms: props.nVms })}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to='/home?s=&t=VM'>{props.nVms}</Link>
=======
                <Icon icon="vm" /> {_('vmPanel', { vms: props.nVms })}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to="/home?s=&t=VM">{props.nVms}</Link>
>>>>>>> Stashed changes
                </p>
              </CardBlock>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='memory' /> {_('memoryStatePanel')}
              </CardHeader>
              <CardBlock className='dashboardItem'>
=======
                <Icon icon="memory" /> {_('memoryStatePanel')}
              </CardHeader>
              <CardBlock className="dashboardItem">
>>>>>>> Stashed changes
                <ChartistGraph
                  data={{
                    labels: ['Used Memory', 'Total Memory'],
                    series: [
                      props.hostMetrics.memoryUsage,
                      props.hostMetrics.memoryTotal -
<<<<<<< Updated upstream
                        props.hostMetrics.memoryUsage,
                    ],
                  }}
                  options={{ donut: true, donutWidth: 40, showLabel: false }}
                  type='Pie'
                />
                <p className='text-xs-center'>
                  {_('ofUsage', {
                    total: formatSize(props.hostMetrics.memoryTotal),
                    usage: formatSize(props.hostMetrics.memoryUsage),
=======
                        props.hostMetrics.memoryUsage
                    ]
                  }}
                  options={{ donut: true, donutWidth: 40, showLabel: false }}
                  type="Pie"
                />
                <p className="text-xs-center">
                  {_('ofUsage', {
                    total: formatSize(props.hostMetrics.memoryTotal),
                    usage: formatSize(props.hostMetrics.memoryUsage)
>>>>>>> Stashed changes
                  })}
                </p>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='cpu' /> {_('cpuStatePanel')}
              </CardHeader>
              <CardBlock>
                <div className='ct-chart dashboardItem'>
                  <ChartistGraph
                    data={{
                      labels: ['vCPUs', 'CPUs'],
                      series: [props.vmMetrics.vcpus, props.hostMetrics.cpus],
=======
                <Icon icon="cpu" /> {_('cpuStatePanel')}
              </CardHeader>
              <CardBlock>
                <div className="ct-chart dashboardItem">
                  <ChartistGraph
                    data={{
                      labels: ['vCPUs', 'CPUs'],
                      series: [props.vmMetrics.vcpus, props.hostMetrics.cpus]
>>>>>>> Stashed changes
                    }}
                    options={{
                      showLabel: false,
                      showGrid: false,
<<<<<<< Updated upstream
                      distributeSeries: true,
                    }}
                    type='Bar'
                  />
                  <p className='text-xs-center'>
                    {_('ofUsage', {
                      total: `${props.hostMetrics.cpus} CPUs`,
                      usage: `${props.vmMetrics.vcpus} vCPUs`,
=======
                      distributeSeries: true
                    }}
                    type="Bar"
                  />
                  <p className="text-xs-center">
                    {_('ofUsage', {
                      total: `${props.hostMetrics.cpus} CPUs`,
                      usage: `${props.vmMetrics.vcpus} vCPUs`
>>>>>>> Stashed changes
                    })}
                  </p>
                </div>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='disk' /> {_('srUsageStatePanel')}
              </CardHeader>
              <CardBlock>
                <div className='ct-chart dashboardItem'>
                  <BlockLink to='/dashboard/health'>
=======
                <Icon icon="disk" /> {_('srUsageStatePanel')}
              </CardHeader>
              <CardBlock>
                <div className="ct-chart dashboardItem">
                  <BlockLink to="/dashboard/health">
>>>>>>> Stashed changes
                    <ChartistGraph
                      data={{
                        labels: ['Used Space', 'Total Space'],
                        series: [
                          props.srMetrics.srUsage,
<<<<<<< Updated upstream
                          props.srMetrics.srTotal - props.srMetrics.srUsage,
                        ],
=======
                          props.srMetrics.srTotal - props.srMetrics.srUsage
                        ]
>>>>>>> Stashed changes
                      }}
                      options={{
                        donut: true,
                        donutWidth: 40,
<<<<<<< Updated upstream
                        showLabel: false,
                      }}
                      type='Pie'
                    />
                    <p className='text-xs-center'>
                      {_('ofUsage', {
                        total: formatSize(props.srMetrics.srTotal),
                        usage: formatSize(props.srMetrics.srUsage),
=======
                        showLabel: false
                      }}
                      type="Pie"
                    />
                    <p className="text-xs-center">
                      {_('ofUsage', {
                        total: formatSize(props.srMetrics.srTotal),
                        usage: formatSize(props.srMetrics.srUsage)
>>>>>>> Stashed changes
                      })}
                    </p>
                  </BlockLink>
                </div>
              </CardBlock>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='alarm' /> {_('alarmMessage')}
=======
                <Icon icon="alarm" /> {_('alarmMessage')}
>>>>>>> Stashed changes
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link
<<<<<<< Updated upstream
                    to='/dashboard/health'
=======
                    to="/dashboard/health"
>>>>>>> Stashed changes
                    className={props.nAlarmMessages > 0 ? 'text-warning' : ''}
                  >
                    {props.nAlarmMessages}
                  </Link>
                </p>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='task' /> {_('taskStatePanel')}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to='/tasks'>{props.nTasks}</Link>
=======
                <Icon icon="task" /> {_('taskStatePanel')}
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  <Link to="/tasks">{props.nTasks}</Link>
>>>>>>> Stashed changes
                </p>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='user' /> {_('usersStatePanel')}
=======
                <Icon icon="user" /> {_('usersStatePanel')}
>>>>>>> Stashed changes
              </CardHeader>
              <CardBlock>
                <p className={styles.bigCardContent}>
                  {props.isAdmin ? (
<<<<<<< Updated upstream
                    <Link to='/settings/users'>{nUsers}</Link>
=======
                    <Link to="/settings/users">{nUsers}</Link>
>>>>>>> Stashed changes
                  ) : (
                    <p>{nUsers}</p>
                  )}
                </p>
              </CardBlock>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col mediumSize={4}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='vm-force-shutdown' /> {_('vmStatePanel')}
              </CardHeader>
              <CardBlock className='dashboardItem'>
                <BlockLink to='/home?t=VM'>
=======
                <Icon icon="vm-force-shutdown" /> {_('vmStatePanel')}
              </CardHeader>
              <CardBlock className="dashboardItem">
                <BlockLink to="/home?t=VM">
>>>>>>> Stashed changes
                  <ChartistGraph
                    data={{
                      labels: ['Running', 'Halted', 'Other'],
                      series: [
                        props.vmMetrics.running,
                        props.vmMetrics.halted,
<<<<<<< Updated upstream
                        props.vmMetrics.other,
                      ],
                    }}
                    options={{ showLabel: false }}
                    type='Pie'
                  />
                  <p className='text-xs-center'>
                    {_('vmsStates', {
                      running: props.vmMetrics.running,
                      halted: props.vmMetrics.halted,
=======
                        props.vmMetrics.other
                      ]
                    }}
                    options={{ showLabel: false }}
                    type="Pie"
                  />
                  <p className="text-xs-center">
                    {_('vmsStates', {
                      running: props.vmMetrics.running,
                      halted: props.vmMetrics.halted
>>>>>>> Stashed changes
                    })}
                  </p>
                </BlockLink>
              </CardBlock>
            </Card>
          </Col>
          <Col mediumSize={8}>
            <Card>
              <CardHeader>
<<<<<<< Updated upstream
                <Icon icon='disk' /> {_('srTopUsageStatePanel')}
              </CardHeader>
              <CardBlock className='dashboardItem'>
                <BlockLink to='/dashboard/health'>
=======
                <Icon icon="disk" /> {_('srTopUsageStatePanel')}
              </CardHeader>
              <CardBlock className="dashboardItem">
                <BlockLink to="/dashboard/health">
>>>>>>> Stashed changes
                  <ChartistGraph
                    style={{ strokeWidth: '30px' }}
                    data={{
                      labels: map(props.topWritableSrs, 'name_label'),
                      series: map(
                        props.topWritableSrs,
                        sr => sr.physical_usage / sr.size * 100
<<<<<<< Updated upstream
                      ),
=======
                      )
>>>>>>> Stashed changes
                    }}
                    options={{
                      showLabel: false,
                      showGrid: false,
                      distributeSeries: true,
<<<<<<< Updated upstream
                      high: 100,
                    }}
                    type='Bar'
=======
                      high: 100
                    }}
                    type="Bar"
>>>>>>> Stashed changes
                  />
                </BlockLink>
              </CardBlock>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col>
            <PatchesCard hosts={props.hosts} />
          </Col>
        </Row>
      </Container>
    ) : (
      <Container>
<<<<<<< Updated upstream
        <Upgrade place='dashboard' available={3} />
=======
        <Upgrade place="dashboard" available={3} />
>>>>>>> Stashed changes
      </Container>
    )
  }
}
