# Changelog

All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [2.3.0] - 2024-06-04

- MINOR: Add support for `as` expressions in inline arguments to `readOnly`
- PATCH: Toling dependency version updates

## [2.2.0] - 2024-04-29

- MINOR: Add explicit support for React-specific objects in `readOnly`

## [2.1.0] - 2024-04-24

- MINOR: Accept inline non-function wrapped parameters to `readOnly`
- MINOR: Avoid using proxies in `readOnly` for non-complex values
- MINOR: Eagerly mark objects and arrays as immutable in `readOnly`

## [2.0.0] - 2024-04-09

- MAJOR Don't transitively apply immutability to results of method calls of immutable values
- MAJOR Exempt object and array literals from wrapping if they're directly passed to an allowlisted function
- MAJOR Remove RequestLocalProxy mechanism

## [1.0.2] - 2024-04-02

- PATCH Fix type checking/inference of `Immutable` functions
 
## [1.0.1] - 2024-03-28
 
### Fixed
 
- PATCH Fix support for nested objects in readOnly lifetimes.
- PATCH Add NPM readme links to package.jsons
- PATCH Fix typo in project readme

## [1.0.0] - 2024-03-06

Initial Release.