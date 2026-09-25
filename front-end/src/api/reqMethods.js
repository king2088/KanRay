export function attachMethods(target, fn) {
  target.post = (url, data, config) => fn({ ...config, url, data, method: 'post' })
  target.put = (url, data, config) => fn({ ...config, url, data, method: 'put' })
  target.patch = (url, data, config) => fn({ ...config, url, data, method: 'patch' })
  target.get = (url, config) => fn({ ...config, url, method: 'get' })
  target.delete = (url, config) => fn({ ...config, url, method: 'delete' })
  target.head = (url, config) => fn({ ...config, url, method: 'head' })
  target.options = (url, config) => fn({ ...config, url, method: 'options' })
  return target
}