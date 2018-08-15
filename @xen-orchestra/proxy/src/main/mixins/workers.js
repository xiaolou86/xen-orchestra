import Worker from 'jest-worker'

export default class Workers {
  get worker () {
    return this._worker
  }

  getNumberOfWorkers () {
    return 42
  }

  constructor (app) {
    app.on('start', () => {
      this._worker = new Worker(require.resolve('../../worker'))
    })
    app.on('stop', () => this._worker.end())
  }
}
