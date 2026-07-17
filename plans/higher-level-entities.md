# Higher Level Entities in House Construction

We now have base level entities like room, slab, bean, roof etc. However when we actually design houses, there are interdependencies between these base level objects. Like multiple rooms on a floor have strict positional relationships, the roof sections have strict relationships to the floor and the rooms in the floor. We can introduce formulae in the values of base object parameters that represent the dimensional points of other objects, so that the dependency relationships can be enforced through such formulae. 

We need to create a higher level language that allows a user to specify design requirements in higher level terms. 

For example, start with the site area. Then ask for the shape of the house - square, rectangular, L shaped, etc. Then ask if there is a floor space limit they want to build within (because that determines the construction cost). Then ask how many floors. Number of rooms, type of rooms. Each type of room may have some typical configurations. Like a bathroom will have relatively smaller size than a bedroom. Bedrooms can have attached bathrooms or bathrooms can be shared. Bathrooms on multiple floors have to typically align vertically for efficient plumbing. Living rooms can be combined with dining room and kitchen or can be kept separate. ...

These are some initial ideas. We should develop a rich language for users to specify what they want, and then derive the base object configurations from this.

This approach will not only allow the user to create the house but keep making changes without having to make multiple changes to dependent objects.

