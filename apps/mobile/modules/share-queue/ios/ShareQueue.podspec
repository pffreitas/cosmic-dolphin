Pod::Spec.new do |s|
  s.name = 'ShareQueue'
  s.version = '1.0.0'
  s.summary = 'Shared save-only keychain bridge'
  s.description = 'Exact app/extension keychain interoperability for save-only credentials.'
  s.license = { :type => 'MIT' }
  s.author = 'Cosmic Dolphin'
  s.homepage = 'https://github.com/pffreitas/cosmic-dolphin'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.frameworks = 'Security'
  s.swift_version = '5.0'
end
