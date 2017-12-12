import React from 'react'
import Component from 'base-component'
import { connectStore } from 'utils'
import { createGetObjectsOfType } from 'selectors'
import SortableTree from 'react-sortable-tree'
import { map, filter, toArray } from 'lodash'
import { get } from 'xo-defined'

@connectStore({
  vms: createGetObjectsOfType('VM'),
  hosts: createGetObjectsOfType('host'),
  pools: createGetObjectsOfType('pool')
})
export default class Tree extends Component {
  constructor(props) {
    super(props)

    this.state = {
      treeData: [{ title: 'Chicken', children: [{ title: 'Egg' }] }]
    }
  }

  componentDidMount() {
    this._updateTree()
  }

  componentWillReceiveProps(newProps) {
    console.log('newProps', newProps)
    if (newProps !== this.props) {
      this._updateTree(newProps)
    }
  }

  _updateTree = newProps => {
    const { vms, hosts, pools } = newProps || this.props
    console.log('pools', pools)
    const { tree: previousTree } = this.state
    console.log('previousTree', previousTree)

    const tree = map(toArray(pools), (pool, poolIndex) => ({
      title: pool.name_label,
      subtitle: pool.name_description,
      expanded: get(() => previousTree[poolIndex].expanded) || false,
      children: map(
        toArray(filter(hosts, ['$pool', pool.id])),
        (host, hostIndex) => ({
          title: host.name_label,
          subtitle: host.name_description,
          expanded:
            get(() => previousTree[poolIndex].children[hostIndex].expanded) ||
            false,
          children: map(filter(vms, ['$container', host.id]), vm => ({
            title: vm.name_label,
            subtitle: vm.name_description
          }))
        })
      ).concat(
        map(filter(vms, ['$container', pool.id]), vm => ({
          title: vm.name_label,
          subtitle: vm.name_description
        }))
      )
    }))

    console.log('tree', tree)
    this.setState({ tree })
  }

  _onChange = tree => this.setState({ tree })

  render() {
    return (
      <div style={{ height: '100vh' }}>
        <SortableTree treeData={this.state.tree} onChange={this._onChange} />
      </div>
    )
  }
}
