import Collection from 'xo-collection'
import createDebug from 'debug'
import kindOf from 'kindof'
import ms from 'ms'
import httpRequest from 'http-request-plus'
import { BaseError } from 'make-error'
import { EventEmitter } from 'events'
import { filter, forEach, isArray, isObject, map, noop, omit, reduce, startsWith } from 'lodash'
import {
  Cancel,
  cancelable,
  catchPlus as pCatch,
  defer,
  delay as pDelay,
  fromEvent,
  lastly
} from 'promise-toolbox'

import autoTransport from './transports/auto'

const debug = createDebug('xen-api')

// ===================================================================

// http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
const NETWORK_ERRORS = {
  // Connection has been closed outside of our control.
  ECONNRESET: true,

  // Connection has been aborted locally.
  ECONNABORTED: true,

  // Host is up but refuses connection (typically: no such service).
  ECONNREFUSED: true,

  // TODO: ??
  EINVAL: true,

  // Host is not reachable (does not respond).
  EHOSTUNREACH: true,

  // Connection configured timed out has been reach.
  ETIMEDOUT: true
}

const isNetworkError = ({code}) => NETWORK_ERRORS[code]

// -------------------------------------------------------------------

const XAPI_NETWORK_ERRORS = {
  HOST_STILL_BOOTING: true,
  HOST_HAS_NO_MANAGEMENT_IP: true
}

const isXapiNetworkError = ({code}) => XAPI_NETWORK_ERRORS[code]

// -------------------------------------------------------------------

const areEventsLost = ({code}) => code === 'EVENTS_LOST'

const isHostSlave = ({code}) => code === 'HOST_IS_SLAVE'

const isMethodUnknown = ({code}) => code === 'MESSAGE_METHOD_UNKNOWN'

const isSessionInvalid = ({code}) => code === 'SESSION_INVALID'

// -------------------------------------------------------------------

class XapiError extends BaseError {
  constructor ([code, ...params]) {
    super(`${code}(${params.join(', ')})`)

    this.code = code
    this.params = params

    // slot than can be assigned later
    this.method = null
  }
}

export const wrapError = error => new XapiError(error)

// ===================================================================

const URL_RE = /^(?:(https?:)\/*)?(?:([^:]+):([^@]+)@)?([^/]+?)(?::([0-9]+))?\/?$/
const parseUrl = url => {
  const matches = URL_RE.exec(url)
  if (!matches) {
    throw new Error('invalid URL: ' + url)
  }

  const [ , protocol = 'https:', username, password, hostname, port ] = matches
  return { protocol, username, password, hostname, port }
}

// -------------------------------------------------------------------

const {
  create: createObject,
  defineProperties,
  defineProperty,
  freeze: freezeObject
} = Object

// -------------------------------------------------------------------

const OPAQUE_REF_PREFIX = 'OpaqueRef:'
export const isOpaqueRef = value =>
  typeof value === 'string' &&
  startsWith(value, OPAQUE_REF_PREFIX)

// -------------------------------------------------------------------

const RE_READ_ONLY_METHOD = /^[^.]+\.get_/
const isReadOnlyCall = (method, args) => (
  args.length === 1 &&
  isOpaqueRef(args[0]) &&
  RE_READ_ONLY_METHOD.test(method)
)

// -------------------------------------------------------------------

const getKey = o => o.$id

// -------------------------------------------------------------------

const EMPTY_ARRAY = freezeObject([])

// -------------------------------------------------------------------

const TASK_RESULT_PREFIX_LEN = '<value>'.length
const TASK_RESULT_SUFFIX_LEN = '</value>'.length

const getTaskResult = (task, onSuccess, onFailure) => {
  const { status } = task
  if (status === 'cancelled') {
    return [ onFailure(new Cancel('task canceled')) ]
  }
  if (status === 'failure') {
    return [ onFailure(wrapError(task.error_info)) ]
  }
  if (status === 'success') {
    // a task result is either void or a ref, it should be fine to
    // remove the XML prefix/suffix
    return [ onSuccess(task.result.slice(
      TASK_RESULT_PREFIX_LEN,
      -TASK_RESULT_SUFFIX_LEN
    )) ]
  }
}

// -------------------------------------------------------------------

const MAX_TRIES = 5

const CONNECTED = 'connected'
const CONNECTING = 'connecting'
const DISCONNECTED = 'disconnected'

// -------------------------------------------------------------------

export class Xapi extends EventEmitter {
  constructor (opts) {
    super()

    this._allowUnauthorized = opts.allowUnauthorized
    this._auth = opts.auth
    this._pool = null
    this._readOnly = Boolean(opts.readOnly)
    this._sessionId = null
    const url = this._url = parseUrl(opts.url)

    if (this._auth === undefined) {
      const user = url.username
      if (user !== undefined) {
        this._auth = {
          user,
          password: url.password
        }
        delete url.username
        delete url.password
      }
    }

    if (opts.watchEvents !== false) {
      this._debounce = opts.debounce == null
        ? 200
        : opts.debounce
      this._fromToken = ''

      // Memoize this function _addObject().
      this._getPool = () => this._pool

      const objects = this._objects = new Collection()
      objects.getKey = getKey

      this._objectsByRefs = createObject(null)
      this._objectsByRefs['OpaqueRef:NULL'] = null

      this._taskWatchers = Object.create(null)

      this.on('connected', this._watchEvents)
      this.on('disconnected', () => {
        this._fromToken = ''
        objects.clear()
      })
    }
  }

  get _url () {
    return this.__url
  }

  set _url (url) {
    this.__url = url
    this._call = autoTransport({
      allowUnauthorized: this._allowUnauthorized,
      url
    })
  }

  get readOnly () {
    return this._readOnly
  }

  set readOnly (ro) {
    this._readOnly = Boolean(ro)
  }

  get sessionId () {
    const id = this._sessionId

    if (!id || id === CONNECTING) {
      throw new Error('sessionId is only available when connected')
    }

    return id
  }

  get status () {
    const id = this._sessionId

    return id
      ? (
        id === CONNECTING
          ? CONNECTING
          : CONNECTED
      )
      : DISCONNECTED
  }

  get _humanId () {
    return `${this._auth.user}@${this._url.hostname}`
  }

  connect () {
    const {status} = this

    if (status === CONNECTED) {
      return Promise.reject(new Error('already connected'))
    }

    if (status === CONNECTING) {
      return Promise.reject(new Error('already connecting'))
    }

    this._sessionId = CONNECTING

    return this._transportCall('session.login_with_password', [
      this._auth.user,
      this._auth.password
    ]).then(
      sessionId => {
        this._sessionId = sessionId

        debug('%s: connected', this._humanId)

        this.emit(CONNECTED)
      },
      error => {
        this._sessionId = null

        throw error
      }
    )
  }

  disconnect () {
    return Promise.resolve().then(() => {
      const { status } = this

      if (status === DISCONNECTED) {
        return Promise.reject(new Error('already disconnected'))
      }

      this._sessionId = null

      debug('%s: disconnected', this._humanId)

      this.emit(DISCONNECTED)
    })
  }

  // High level calls.
  call (method, ...args) {
    return this._readOnly && !isReadOnlyCall(method, args)
      ? Promise.reject(new Error(`cannot call ${method}() in read only mode`))
      : this._sessionCall(method, args)
  }

  @cancelable
  callAsync ($cancelToken, method, ...args) {
    return this.call(`Async.${method}`, ...args).then(taskRef => {
      $cancelToken.promise.then(() => {
        this._sessionCall('task.cancel', taskRef).catch(noop)
      })

      return this.watchTask(taskRef)::lastly(() => {
        this._sessionCall('task.destroy', taskRef).catch(noop)
      })
    })
  }

  // create a task and automatically destroy it when settled
  createTask (nameLabel, nameDescription = '') {
    const promise = this._sessionCall('task.create', [
      nameLabel,
      nameDescription
    ])

    promise.then(taskRef => {
      const destroy = () =>
        this._sessionCall('task.destroy', taskRef).catch(noop)
      this.watchTask(taskRef).then(destroy, destroy)
    })

    return promise
  }

  // Nice getter which returns the object for a given $id (internal to
  // this lib), UUID (unique identifier that some objects have) or
  // opaque reference (internal to XAPI).
  getObject (idOrUuidOrRef, defaultValue) {
    const object = typeof idOrUuidOrRef === 'string'
      ? (
        // if there is an UUID, it is also the $id.
        this._objects.all[idOrUuidOrRef] ||
        this._objectsByRefs[idOrUuidOrRef]
      )
      : this._objects.all[idOrUuidOrRef.$id]

    if (object) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('there is not object can be matched to ' + idOrUuidOrRef)
  }

  // Returns the object for a given opaque reference (internal to
  // XAPI).
  getObjectByRef (ref, defaultValue) {
    const object = this._objectsByRefs[ref]

    if (object) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('there is no object with the ref ' + ref)
  }

  // Returns the object for a given UUID (unique identifier that some
  // objects have).
  getObjectByUuid (uuid, defaultValue) {
    // Objects ids are already UUIDs if they have one.
    const object = this._objects.all[uuid]

    if (object) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('there is no object with the UUID ' + uuid)
  }

  @cancelable
  getResource ($cancelToken, pathname, {
    host,
    query,
    task = this._taskWatchers !== undefined
  }) {
    return Promise.resolve(
      task
        ? this.createTask(`Xapi#getResource ${pathname}`)
        : undefined
    ).then(taskRef => {
      query = { ...query, session_id: this.sessionId }
      let taskResult
      if (taskRef !== undefined) {
        query.task_id = taskRef
        taskResult = this.watchTask(taskRef)

        if (typeof $cancelToken.addHandler === 'function') {
          $cancelToken.addHandler(() => task)
        }
      }

      let promise = httpRequest(
        $cancelToken,
        this._url,
        host && {
          hostname: this.getObject(host).address
        },
        {
          pathname,
          query,
          rejectUnauthorized: !this._allowUnauthorized
        }
      )

      if (taskResult !== undefined) {
        promise = promise.then(response => {
          response.task = taskResult
          return response
        })
      }

      return promise
    })
  }

  @cancelable
  putResource ($cancelToken, body, pathname, {
    host,
    query,
    task = this._taskWatchers !== undefined
  } = {}) {
    return Promise.resolve(
      task
        ? this.createTask(`Xapi#putResource ${pathname}`)
        : undefined
    ).then(taskRef => {
      query = { ...query, session_id: this.sessionId }

      let taskResult
      if (taskRef !== undefined) {
        query.task_id = taskRef
        taskResult = this.watchTask(taskRef)

        if (typeof $cancelToken.addHandler === 'function') {
          $cancelToken.addHandler(() => task)
        }
      }

      const headers = {}

      // Xen API does not support chunk encoding.
      const isStream = typeof body.pipe === 'function'
      const { length } = body
      if (isStream && length === undefined) {
        // add a fake huge content length (1 PiB)
        headers['content-length'] = '1125899906842624'
      }

      const doRequest = override => httpRequest.put(
        $cancelToken,
        this._url,
        host && {
          hostname: this.getObject(host).address
        },
        {
          body,
          headers,
          pathname,
          query: {
            ...query,
            session_id: this.sessionId
          },
          rejectUnauthorized: !this._allowUnauthorized
        },
        override
      )

      const promise = isStream

        // dummy request to probe for a redirection before consuming body
        ? doRequest({
          body: '',
          query: {
            // omit task_id because this request will fail on purpose
            ...(
              query != null && 'task_id' in query
              ? omit(query, 'task_id')
              : query
            ),
            session_id: this.sessionId
          },
          maxRedirects: 0
        }).then(
          response => {
            response.req.abort()
            return doRequest()
          },
          error => {
            let response
            if (error != null && (response = error.response) != null) {
              response.req.abort()

              const { headers: { location }, statusCode } = response
              if (statusCode === 302 && location !== undefined) {
                return doRequest(location)
              }
            }

            throw error
          }
        )

        // http-request-plus correctly handle redirects if body is not a stream
        : doRequest()

      return promise.then(response => {
        const { req } = response

        if (req.finished) {
          req.abort()
          return taskResult
        }

        return fromEvent(req, 'finish').then(() => {
          req.abort()
          return taskResult
        })
      })
    })
  }

  watchTask (ref) {
    const watchers = this._taskWatchers
    if (watchers === undefined) {
      throw new Error('Xapi#watchTask() requires events watching')
    }

    // allow task object to be passed
    if (ref.$ref !== undefined) ref = ref.$ref

    let watcher = watchers[ref]
    if (watcher === undefined) {
      // sync check if the task is already settled
      const task = this.objects.all[ref]
      if (task !== undefined) {
        const result = getTaskResult(task, Promise.resolve, Promise.reject)
        if (result) {
          return result[0]
        }
      }

      watcher = watchers[ref] = defer()
    }
    return watcher.promise
  }

  get pool () {
    return this._pool
  }

  get objects () {
    return this._objects
  }

  // Medium level call: handle session errors.
  _sessionCall (method, args) {
    try {
      if (startsWith(method, 'session.')) {
        throw new Error('session.*() methods are disabled from this interface')
      }

      return this._transportCall(method, [this.sessionId].concat(args))
        ::pCatch(isSessionInvalid, () => {
          // XAPI is sometimes reinitialized and sessions are lost.
          // Try to login again.
          debug('%s: the session has been reinitialized', this._humanId)

          this._sessionId = null
          return this.connect().then(() => this._sessionCall(method, args))
        })
    } catch (error) {
      return Promise.reject(error)
    }
  }

  _addObject (type, ref, object) {
    const {_objectsByRefs: objectsByRefs} = this

    const reservedKeys = {
      id: true,
      pool: true,
      ref: true,
      type: true
    }
    const getKey = (key, obj) => reservedKeys[key] && obj === object
      ? `$$${key}`
      : `$${key}`

    // Creates resolved properties.
    forEach(object, function resolveObject (value, key, object) {
      if (isArray(value)) {
        if (!value.length) {
          // If the array is empty, it isn't possible to be sure that
          // it is not supposed to contain links, therefore, in
          // benefice of the doubt, a resolved property is defined.
          defineProperty(object, getKey(key, object), {
            value: EMPTY_ARRAY
          })

          // Minor memory optimization, use the same empty array for
          // everyone.
          object[key] = EMPTY_ARRAY
        } else if (isOpaqueRef(value[0])) {
          // This is an array of refs.
          defineProperty(object, getKey(key, object), {
            get: () => freezeObject(map(value, (ref) => objectsByRefs[ref]))
          })

          freezeObject(value)
        }
      } else if (isObject(value)) {
        forEach(value, resolveObject)

        freezeObject(value)
      } else if (isOpaqueRef(value)) {
        defineProperty(object, getKey(key, object), {
          get: () => objectsByRefs[value]
        })
      }
    })

    // All custom properties are read-only and non enumerable.
    defineProperties(object, {
      $id: { value: object.uuid || ref },
      $pool: { get: this._getPool },
      $ref: { value: ref },
      $type: { value: type }
    })

    // Finally freezes the object.
    freezeObject(object)

    const objects = this._objects

    // An object's UUID can change during its life.
    const prev = objectsByRefs[ref]
    let prevUuid
    if (prev && (prevUuid = prev.uuid) && prevUuid !== object.uuid) {
      objects.remove(prevUuid)
    }

    this._objects.set(object)
    objectsByRefs[ref] = object

    if (type === 'pool') {
      this._pool = object
    } else if (type === 'task') {
      const taskWatchers = this._taskWatchers
      let taskWatcher = taskWatchers[ref]
      if (
        taskWatcher !== undefined &&
        getTaskResult(object, taskWatcher.resolve, taskWatcher.reject)
      ) {
        delete taskWatchers[ref]
      }
    }
  }

  _removeObject (ref) {
    const byRefs = this._objectsByRefs
    const object = byRefs[ref]
    if (object !== undefined) {
      this._objects.unset(object.$id)
      delete byRefs[ref]
    }

    const taskWatchers = this._taskWatchers
    const taskWatcher = taskWatchers[ref]
    if (taskWatcher !== undefined) {
      taskWatcher.reject(new Error('task has been detroyed before completion'))
      delete taskWatchers[ref]
    }
  }

  _processEvents (events) {
    forEach(events, event => {
      const {operation: op} = event

      const {ref} = event
      if (op === 'del') {
        this._removeObject(ref)
      } else {
        this._addObject(event.class, ref, event.snapshot)
      }
    })
  }

  _watchEvents () {
    const loop = () => this.status === CONNECTED && this._sessionCall('event.from', [
      ['*'],
      this._fromToken,
      60 + 0.1 // Force float.
    ]).then(onSuccess, onFailure)

    const onSuccess = ({token, events}) => {
      this._fromToken = token
      this._processEvents(events)

      const debounce = this._debounce
      return debounce != null
        ? pDelay(debounce).then(loop)
        : loop()
    }
    const onFailure = error => {
      if (areEventsLost(error)) {
        this._fromToken = ''
        this._objects.clear()

        return loop()
      }

      throw error
    }

    return loop()::pCatch(
      isMethodUnknown,

      // If the server failed, it is probably due to an excessively
      // large response.
      // Falling back to legacy events watch should be enough.
      error => error && error.res && error.res.statusCode === 500,

      () => this._watchEventsLegacy()
    )
  }

  // This method watches events using the legacy `event.next` XAPI
  // methods.
  //
  // It also has to manually get all objects first.
  _watchEventsLegacy () {
    const getAllObjects = () => {
      return this._sessionCall('system.listMethods', []).then(methods => {
        // Uses introspection to determine the methods to use to get
        // all objects.
        const getAllRecordsMethods = filter(
          methods,
          ::/\.get_all_records$/.test
        )

        return Promise.all(map(
          getAllRecordsMethods,
          method => this._sessionCall(method, []).then(
            objects => {
              const type = method.slice(0, method.indexOf('.')).toLowerCase()
              forEach(objects, (object, ref) => {
                this._addObject(type, ref, object)
              })
            },
            error => {
              if (error.code !== 'MESSAGE_REMOVED') {
                throw error
              }
            }
          )
        ))
      })
    }

    const watchEvents = () => this._sessionCall('event.register', [ ['*'] ]).then(loop)

    const loop = () => this.status === CONNECTED && this._sessionCall('event.next', []).then(onSuccess, onFailure)

    const onSuccess = events => {
      this._processEvents(events)

      const debounce = this._debounce
      return debounce == null
        ? loop()
        : pDelay(debounce).then(loop)
    }

    const onFailure = error => {
      if (areEventsLost(error)) {
        return this._sessionCall('event.unregister', [ ['*'] ]).then(watchEvents)
      }

      throw error
    }

    return getAllObjects().then(watchEvents)
  }
}

Xapi.prototype._transportCall = reduce([
  function (method, args) {
    return this._call(method, args).catch(error => {
      if (isArray(error)) {
        error = wrapError(error)
      }

      error.method = method
      throw error
    })
  },
  call => function () {
    let tries = 1
    const loop = () => call.apply(this, arguments)
      ::pCatch(isNetworkError, isXapiNetworkError, error => {
        debug('%s: network error %s', this._humanId, error.code)

        if (++tries < MAX_TRIES) {
          // TODO: ability to cancel the connection
          // TODO: ability to force immediate reconnection
          // TODO: implement back-off

          return pDelay(5e3).then(loop)
        }

        debug('%s too many network errors (%s), give up', this._humanId, tries)

        // mark as disconnected
        this.disconnect()::pCatch(noop)

        throw error
      })
    return loop()
  },
  call => function loop () {
    return call.apply(this, arguments)
      ::pCatch(isHostSlave, ({params: [master]}) => {
        debug('%s: host is slave, attempting to connect at %s', this._humanId, master)

        const newUrl = {
          ...this._url,
          hostname: master
        }
        this.emit('redirect', newUrl)
        this._url = newUrl

        return loop.apply(this, arguments)
      })
  },
  call => function (method) {
    const startTime = Date.now()
    return call.apply(this, arguments).then(
      result => {
        debug(
          '%s: %s(...) [%s] ==> %s',
          this._humanId,
          method,
          ms(Date.now() - startTime),
          kindOf(result)
        )
        return result
      },
      error => {
        debug(
          '%s: %s(...) [%s] =!> %s',
          this._humanId,
          method,
          ms(Date.now() - startTime),
          error
        )
        throw error
      }
    )
  }
], (call, decorator) => decorator(call))

// ===================================================================

// The default value is a factory function.
export const createClient = opts => new Xapi(opts)